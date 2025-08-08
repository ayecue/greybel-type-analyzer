import {
  SignatureDefinitionFunction,
  SignatureDefinitionTypeMeta
} from 'meta-utils';
import {
  ASTAssignmentStatement,
  ASTBase,
  ASTBaseBlockWithScope,
  ASTChunk,
  ASTFunctionStatement,
  ASTReturnStatement,
  ASTType
} from 'miniscript-core';

import { ASTDefinitionAggregator } from '../aggregator/ast-definition-aggregator';
import { InferContext } from '../inference/infer-context';
import { InferFullExpression } from '../inference/infer-full-expression';
import { InferLightExpression } from '../inference/infer-light-expression';
import { DocumentTypeStorage } from '../storage/document-type-storage';
import { TypeStorage } from '../storage/type-storage';
import {
  IDocument,
  IDocumentMergeItem,
  IResolveNamespaceResult
} from '../types/document';
import { IScope, IScopeMetadata, ScopeState } from '../types/scope';
import {
  IEntityInfo,
  IFunctionType,
  isFunctionType,
  isListType,
  isMapType,
  IType,
  NIL_TYPE_ID,
  SymbolInfo,
  TypeKind,
  UNKNOWN_TYPE_ID
} from '../types/type';
import { ITypeManager } from '../types/type-manager';
import { ChunkHelper } from '../utils/chunk-helper';
import { determineTypeFromMeta } from '../utils/determine-type-from-meta';
import { mergeScope } from '../utils/merge-helper';
import { Scope } from './scope';
import { Type } from './type';
import { UnionType } from './union-type';
import { CompletionItemKind } from '../types/completion';
import { assumeCompletionItemKind } from '../utils/assume-completion-item-kind';

export class Document implements IDocument {
  public readonly name: string;
  public readonly globals: IScope;

  public readonly chunk: ASTChunk;
  public readonly chunkHelper: ChunkHelper;

  public readonly scopes: IScopeMetadata[] = [];
  public readonly scopeRefMapping: WeakMap<
    ASTBaseBlockWithScope,
    IScopeMetadata
  >;

  public readonly scopeFnMapping: WeakMap<IType, IScopeMetadata>;

  public readonly typeStorage: DocumentTypeStorage;
  public readonly typeManager: ITypeManager;

  constructor(
    name: string,
    chunk: ASTChunk,
    typeManager: ITypeManager,
    typeStorage: TypeStorage
  ) {
    this.name = name;
    this.chunk = chunk;
    this.typeManager = typeManager;
    this.typeStorage = new DocumentTypeStorage(this, typeStorage);
    this.globals = new Scope(this);
    this.scopeRefMapping = new WeakMap();
    this.scopeFnMapping = new WeakMap();
    this.chunkHelper = new ChunkHelper(chunk);

    this.typeStorage.insertDefault();
    typeManager.modifyTypeStorage?.(this, typeStorage);
  }

  private createScope(block: ASTBaseBlockWithScope) {
    if (this.scopeRefMapping.has(block)) {
      return; // already aggregated
    }

    const parentScopeMetadata = this.scopeRefMapping.get(block.scope);
    const newScope = new Scope(this, parentScopeMetadata.scope);
    const metadata: IScopeMetadata = {
      scope: newScope,
      astRef: block,
      state: ScopeState.Inititialized
    };

    this.scopes.push(metadata);
    this.scopeRefMapping.set(block, metadata);
  }

  aggregateScopes(): void {
    const root = this.chunk;

    if (this.scopeRefMapping.has(root)) {
      return; // already aggregated
    }

    const rootMetadata: IScopeMetadata = {
      scope: this.globals,
      astRef: root,
      state: ScopeState.Inititialized
    };

    this.scopes.push(rootMetadata);
    this.scopeRefMapping.set(root, rootMetadata);

    for (let index = 0; index < root.scopes.length; index++) {
      const item = root.scopes[index];
      this.createScope(item);
    }
  }

  attachFunctionTypeToScope(
    scope: ASTBaseBlockWithScope,
    type: IFunctionType
  ): void {
    const scopeMetadata = this.scopeRefMapping.get(scope);
    if (scopeMetadata == null) return;
    scopeMetadata.scope.associatedFunction = type;
    this.scopeFnMapping.set(type, scopeMetadata);
  }

  private assumeArgumentTypes(
    scope: ASTFunctionStatement,
    scopeMetadata: IScopeMetadata,
    fnDef: SignatureDefinitionFunction
  ): void {
    const args = fnDef.getArguments();

    for (let index = 0; index < args.length; index++) {
      const arg = args[index];
      const types = arg.getTypes();
      const paramItem = scope.parameters[index];
      const argTypes = types.map((it) =>
        determineTypeFromMeta(
          it,
          this.typeStorage,
          this,
          scopeMetadata.scope,
          paramItem.type === ASTType.AssignmentStatement
            ? (paramItem as ASTAssignmentStatement).init
            : paramItem
        )
      );
      const unionType = new UnionType(
        this.typeStorage.generateId(TypeKind.UnionType),
        argTypes,
        this.typeStorage,
        this,
        scopeMetadata.scope
      );
      scopeMetadata.scope.setProperty(
        arg.getLabel(),
        unionType.variants.length === 1 ? unionType.variants[0] : unionType
      );
    }
  }

  private assumeReturnType(
    scope: ASTFunctionStatement,
    scopeMetadata: IScopeMetadata,
    fnDef: SignatureDefinitionFunction
  ): void {
    if (scope.returns.length === 0) {
      const returnItem = Type.createBaseType(
        NIL_TYPE_ID,
        this.typeStorage,
        this,
        scopeMetadata.scope
      );
      scopeMetadata.scope.associatedFunction.returnType = returnItem;
      // @ts-expect-error
      fnDef._returns = returnItem
        .toMeta()
        .map(SignatureDefinitionTypeMeta.parse);
      return;
    }

    // If the scope does not have a meta docs, we need to infer the return type
    const returnType = new UnionType(
      this.typeStorage.generateId(TypeKind.UnionType),
      [],
      this.typeStorage,
      this,
      scopeMetadata.scope
    );

    for (let index = 0; index < scope.returns.length; index++) {
      const returnRef = scope.returns[index] as ASTReturnStatement;

      if (returnRef.argument == null) {
        returnType.addVariant(
          Type.createBaseType(
            NIL_TYPE_ID,
            this.typeStorage,
            this,
            scopeMetadata.scope
          )
        );
        continue; // no return value
      }

      const type = new InferFullExpression(
        new InferContext(this.typeStorage, this, scopeMetadata.scope)
      ).infer(returnRef.argument);

      if (type) returnType.addVariant(type);
    }

    const returnItem =
      returnType.variants.length === 1 ? returnType.variants[0] : returnType;

    scopeMetadata.scope.associatedFunction.returnType = returnItem;
    // @ts-expect-error
    fnDef._returns = returnItem.toMeta().map(SignatureDefinitionTypeMeta.parse);
  }

  aggregateDefinition(scope: ASTBaseBlockWithScope): void {
    const scopeMetadata = this.scopeRefMapping.get(scope);

    if (scopeMetadata.state !== ScopeState.Inititialized) {
      return;
    }

    scopeMetadata.state = ScopeState.Pending;

    if (scopeMetadata.scope.associatedFunction == null) {
      // If the scope does not have a type it's most likely a global scope
      const scopeEvaluationsBuilder = new ASTDefinitionAggregator(
        this.typeStorage,
        this,
        scopeMetadata.scope,
        scope,
        (scope: ASTBaseBlockWithScope) => this.aggregateDefinition(scope)
      );

      scopeEvaluationsBuilder.aggregate();
      scopeMetadata.state = ScopeState.Resolved;
      return;
    }

    // Define the function arguments in the scope
    const fnDef = scopeMetadata.scope.associatedFunction
      .signature as SignatureDefinitionFunction;

    this.assumeArgumentTypes(
      scope as ASTFunctionStatement,
      scopeMetadata,
      fnDef
    );

    const scopeEvaluationsBuilder = new ASTDefinitionAggregator(
      this.typeStorage,
      this,
      scopeMetadata.scope,
      scope,
      (scope: ASTBaseBlockWithScope) => this.aggregateDefinition(scope)
    );

    scopeEvaluationsBuilder.aggregate();

    const returnTypes = fnDef.getReturns();

    if (returnTypes.length === 1 && returnTypes[0].type === UNKNOWN_TYPE_ID) {
      this.assumeReturnType(
        scope as ASTFunctionStatement,
        scopeMetadata,
        fnDef
      );
    }

    scopeMetadata.state = ScopeState.Resolved;
  }

  aggregateDefinitions(): void {
    const root = this.chunk;

    this.aggregateDefinition(root);

    for (let index = 0; index < root.scopes.length; index++) {
      const item = root.scopes[index];
      this.aggregateDefinition(item);
    }
  }

  resolveAllAssignmentsWithQuery(query: string): SymbolInfo[] {
    return [
      ...this.scopes.flatMap((scopeMetadata) =>
        scopeMetadata.scope.symbols.filter((symbol) =>
          symbol.path.includes(query)
        )
      )
    ];
  }

  resolveAvailableAssignments(item: ASTBase): SymbolInfo[] {
    const context = new InferContext(this.typeStorage, this, this.globals);
    const itemInfer = new InferLightExpression(context);
    itemInfer.infer(item);

    const associatedScope = this.scopeRefMapping.get(item.scope);
    const scopes = [associatedScope.scope];

    if (associatedScope.scope.outer) {
      scopes.push(associatedScope.scope.outer);
    }

    if (associatedScope.scope !== associatedScope.scope.globals) {
      scopes.push(associatedScope.scope.globals);
    }

    const query = itemInfer.getPath();

    return scopes.flatMap((scope) =>
      scope.symbols.filter((symbol) => symbol.path.includes(query))
    );
  }

  resolvePath(path: string[]): IEntityInfo | undefined {
    return this.globals.locals.getPropertyInPath(path);
  }

  resolveNamespace(
    item: ASTBase,
    invoke: boolean
  ): IResolveNamespaceResult | null {
    const scopeMetadata = this.scopeRefMapping.get(item.scope);
    if (!scopeMetadata) return null;

    const context = new InferContext(
      this.typeStorage,
      this,
      scopeMetadata.scope
    );
    const handler = new InferFullExpression(context, invoke);
    const result = handler.infer(item);

    if (result == null) return null;

    const path = handler.getPath();

    return {
      item: result,
      path,
      value: handler.getValue(),
      completionItemKind: assumeCompletionItemKind(result, path),
      sources: result.getSource()
    };
  }

  merge(...externals: IDocumentMergeItem[]): Document {
    const newDocument = new Document(
      this.name,
      this.chunk,
      this.typeManager,
      this.typeStorage.parent
    );

    newDocument.aggregateScopes();

    // first merge the type storages
    for (let index = 0; index < externals.length; index++) {
      const external = externals[index];
      newDocument.typeStorage.merge(external.document.typeStorage);
      this.typeManager.modifyTypeStorageMerge?.(
        newDocument,
        external.document,
        this.typeStorage.parent
      );
    }

    // assign namespaces from external documents
    for (let index = 0; index < externals.length; index++) {
      const external = externals[index];
      mergeScope(
        newDocument.typeStorage,
        newDocument.globals,
        external.document.globals,
        external.namespaces
      );
    }

    newDocument.aggregateDefinitions();

    return newDocument;
  }
}
