import {
  ASTFeatureImportExpression,
  ASTType as GreybelASTType
} from 'greybel-core';
import { SignatureDefinitionBaseType } from 'meta-utils';
import {
  ASTAssignmentStatement,
  ASTBase,
  ASTBaseBlockWithScope,
  ASTForGenericStatement,
  ASTIdentifier,
  ASTType
} from 'miniscript-core';

import { EntityInfo } from '../entities/entity-info';
import { MapType } from '../entities/map-type';
import { Type } from '../entities/type';
import { UnionType } from '../entities/union-type';
import { UnknownType } from '../entities/unknown-type';
import { InferContext } from '../inference/infer-context';
import { InferFullExpression } from '../inference/infer-full-expression';
import { InferLightExpression } from '../inference/infer-light-expression';
import {
  isVariableSetterContextProperty,
  isVariableSetterContextVariable
} from '../types/ast';
import { CompletionItemKind } from '../types/completion';
import { IDocument, OnRequestScopeCallback } from '../types/document';
import { IScope } from '../types/scope';
import { ITypeStorage } from '../types/storage';
import {
  isFunctionType,
  isListType,
  isMapType,
  isUnionType,
  isUnknownType,
  IType,
  NIL_TYPE_ID,
  TypeKind
} from '../types/type';

export class ASTDefinitionAggregator {
  private typeStorage: ITypeStorage;
  private document: IDocument;
  private scope: IScope;
  private block: ASTBaseBlockWithScope;
  private onRequestScope: OnRequestScopeCallback;

  constructor(
    typeStorage: ITypeStorage,
    document: IDocument,
    scope: IScope,
    block: ASTBaseBlockWithScope,
    onRequestScope: OnRequestScopeCallback
  ) {
    this.typeStorage = typeStorage;
    this.document = document;
    this.scope = scope;
    this.block = block;
    this.onRequestScope = onRequestScope;
  }

  private makeTypeCompatibleWithProperties(
    resolvePath: ASTBase,
    context: InferContext
  ): void {
    const variableSetterCtx =
      this.document.chunkHelper.findAssignmentVariableSetterContext(
        resolvePath
      );

    if (variableSetterCtx == null) {
      return;
    }

    if (isVariableSetterContextVariable(variableSetterCtx)) {
      this.scope.setProperty(
        variableSetterCtx.property,
        MapType.createDefault(this.typeStorage, this.document, this.scope)
      );
      return;
    }

    let origin = new InferLightExpression(context).infer(
      variableSetterCtx.resolvePath
    );

    if (!origin.containsOwnProperties()) {
      this.makeTypeCompatibleWithProperties(
        variableSetterCtx.resolvePath,
        context
      );
      origin = new InferLightExpression(context).infer(
        variableSetterCtx.resolvePath
      );
    }

    if (isVariableSetterContextProperty(variableSetterCtx)) {
      origin.setProperty(
        variableSetterCtx.lastProperty,
        new EntityInfo(
          variableSetterCtx.lastProperty,
          MapType.createDefault(this.typeStorage, this.document, this.scope)
        )
      );
      return;
    }

    const exprKeyType = new InferLightExpression(context).infer(
      variableSetterCtx.lastComponent
    );

    if (isUnionType(exprKeyType)) {
      exprKeyType.variants.forEach((variant) => {
        const keyType = variant.getKeyType();
        if (keyType == null) return;
        origin.setProperty(
          keyType,
          new EntityInfo(
            keyType.id,
            MapType.createDefault(this.typeStorage, this.document, this.scope)
          )
        );
      });
      return;
    }

    const keyType = exprKeyType.getKeyType();
    if (keyType == null) return;
    origin.setProperty(
      keyType,
      new EntityInfo(
        keyType.id,
        MapType.createDefault(this.typeStorage, this.document, this.scope)
      )
    );
  }

  private aggregateAssignmentStatement(item: ASTAssignmentStatement): void {
    const variableSetterCtx =
      this.document.chunkHelper.findAssignmentVariableSetterContext(
        item.variable
      );

    if (variableSetterCtx == null) {
      return;
    }

    const context = new InferContext(
      this.typeStorage,
      this.document,
      this.scope,
      this.onRequestScope
    );
    const initInfer = new InferFullExpression(context);
    const init =
      initInfer.inferCommentDefinition(item) ||
      initInfer
        .infer(item.init)
        ?.copy(
          false,
          false,
          this.typeStorage,
          this.document,
          this.scope,
          item.init
        ) ||
      new UnknownType(this.typeStorage, this.document, this.scope, item);

    if (isFunctionType(init)) {
      this.document.attachFunctionTypeToScope(
        init.astRef as ASTBaseBlockWithScope,
        init
      );
    }

    if (isMapType(init)) {
      initInfer.createCustomTypeFromMap(item.init, init);
    }

    if (isVariableSetterContextVariable(variableSetterCtx)) {
      const key = variableSetterCtx.property;

      this.scope.symbols.push({
        name: key,
        path: key,
        kind: initInfer.getCompletionItemKind(),
        source: init.getSource(),
        assignmentRef: item
      });

      const existingEntity = this.scope.getProperty(key);

      if (existingEntity != null && item.init.type === ASTType.Unknown) {
        // If the init is unknown, we need to check if the key already exists in the scope
        return;
      } else if (existingEntity != null && isUnknownType(existingEntity.type)) {
        // If it's unknown, we can just update the type
        existingEntity.type.mergeIntoType(init);
        this.scope.setProperty(key, init);
        return;
      } else if (existingEntity != null && isUnknownType(init)) {
        init.mergeIntoType(existingEntity.type);
        return;
      }

      // Simple identifier assignment
      this.scope.setProperty(key, init);
      return;
    }

    let originInfer = new InferLightExpression(context);
    let origin = originInfer.infer(variableSetterCtx.resolvePath);

    if (origin == null) {
      // If the origin is null, we cannot assign the property
      throw new Error(`Cannot assign property to null origin`);
    }

    if (!origin.containsOwnProperties()) {
      // If the origin does not contain own properties, we need to make it compatible and refresh the infer
      this.makeTypeCompatibleWithProperties(
        variableSetterCtx.resolvePath,
        context
      );
      originInfer = new InferLightExpression(context);
      origin = originInfer.infer(variableSetterCtx.resolvePath);
    }

    if (isFunctionType(init)) {
      // If the init is a function type, we need to attach it to the self value
      init.context = origin;
    }

    if (isVariableSetterContextProperty(variableSetterCtx)) {
      const key = variableSetterCtx.lastProperty;

      this.scope.symbols.push({
        name: key,
        path: `${originInfer.getPath()}.${key}`,
        kind: initInfer.getCompletionItemKind(),
        source: init.getSource(),
        assignmentRef: item
      });

      const existingEntity = origin.getProperty(key);

      if (existingEntity != null && item.init.type === ASTType.Unknown) {
        // If the init is unknown, we need to check if the key already exists in the scope
        return;
      } else if (existingEntity != null && isUnknownType(existingEntity.type)) {
        // If it's unknown, we can just update the type
        existingEntity.type.mergeIntoType(init);
        origin.setProperty(key, new EntityInfo(key, init));
        return;
      }

      // Property assignment
      origin.setProperty(key, new EntityInfo(key, init));
      return;
    }

    // Index assignment
    const exprKeyType = new InferLightExpression(context).infer(
      variableSetterCtx.lastComponent
    );

    // If the key is a union type, we need to handle each variant
    if (isUnionType(exprKeyType)) {
      exprKeyType.variants.forEach((variant) => {
        const keyType = variant.getKeyType();
        if (keyType == null) return;
        origin.setProperty(keyType, new EntityInfo(keyType.id, init));
      });
      return;
    }

    const keyType = exprKeyType.getKeyType();
    if (keyType == null) return;
    origin.setProperty(keyType, new EntityInfo(keyType.id, init));
  }

  private getVariableTypeFromIterator(
    iterator: IType,
    astRef?: ASTBase
  ): IType {
    if (isMapType(iterator)) {
      // If the iterator is a map type, we need to create a new map type for the variable
      const variable = new MapType(
        this.typeStorage.generateId(TypeKind.MapType, astRef),
        iterator.keyType.copy(
          false,
          true,
          this.typeStorage,
          this.document,
          this.scope
        ),
        iterator.valueType.copy(
          false,
          true,
          this.typeStorage,
          this.document,
          this.scope
        ),
        this.typeStorage,
        this.document,
        this.scope,
        null,
        astRef
      );
      variable.setProperty(
        'key',
        new EntityInfo(
          'key',
          iterator.keyType.copy(
            false,
            true,
            this.typeStorage,
            this.document,
            this.scope
          )
        )
      );
      variable.setProperty(
        'value',
        new EntityInfo(
          'value',
          iterator.valueType.copy(
            false,
            true,
            this.typeStorage,
            this.document,
            this.scope
          )
        )
      );

      return variable;
    } else if (isListType(iterator)) {
      // If the iterator is a list type, we need to copy the element type for the variable
      return iterator.elementType.copy(
        false,
        true,
        this.typeStorage,
        this.document,
        this.scope
      );
    } else if (isUnionType(iterator)) {
      return new UnionType(
        this.typeStorage.generateId(TypeKind.UnionType, astRef),
        iterator.variants.map((item) =>
          this.getVariableTypeFromIterator(item, astRef)
        ),
        this.typeStorage,
        this.document,
        this.scope,
        astRef
      );
    } else if (iterator.id === SignatureDefinitionBaseType.String) {
      // If the iterator is a string type, we need to create a new string type for the variable
      return Type.createBaseType(
        SignatureDefinitionBaseType.String,
        this.typeStorage,
        this.document,
        this.scope,
        astRef
      );
    } else if (iterator.id === NIL_TYPE_ID) {
      // If the iterator is a string type, we need to create a new string type for the variable
      return Type.createBaseType(
        NIL_TYPE_ID,
        this.typeStorage,
        this.document,
        this.scope,
        astRef
      );
    }

    return new UnknownType(this.typeStorage, this.document, this.scope);
  }

  private aggregateForGenericStatement(item: ASTForGenericStatement): void {
    const context = new InferContext(
      this.typeStorage,
      this.document,
      this.scope,
      this.onRequestScope
    );
    const iteratorInfer = new InferFullExpression(context);
    const iterator =
      iteratorInfer.infer(item.iterator) ||
      new UnknownType(this.typeStorage, this.document, this.scope);

    const variable = this.getVariableTypeFromIterator(iterator, item);

    if (item.variable.type !== ASTType.Identifier) {
      return;
    }

    const key = item.variable.name;
    this.scope.setProperty(key, variable);
    this.scope.setProperty(
      `__${key}_idx`,
      Type.createBaseType(
        SignatureDefinitionBaseType.Number,
        this.typeStorage,
        this.document,
        this.scope,
        item.variable
      )
    );

    this.scope.symbols.push(
      {
        name: key,
        path: key,
        kind: CompletionItemKind.Variable,
        source: variable.getSource(),
        assignmentRef: item
      },
      {
        name: `__${key}_idx`,
        path: `__${key}_idx`,
        kind: CompletionItemKind.Variable,
        source: variable.getSource(),
        assignmentRef: item
      }
    );
  }

  private aggregateImportDefinition(item: ASTFeatureImportExpression): void {
    const identifier = item.name as ASTIdentifier;
    const existingEntity = this.scope.getProperty(identifier.name);

    this.scope.symbols.push({
      name: identifier.name,
      path: identifier.name,
      kind: CompletionItemKind.Variable,
      source: [
        {
          document: this.document.name,
          astRef: item,
          start: identifier.start,
          end: identifier.end
        }
      ],
      assignmentRef: item
    });

    if (existingEntity != null) {
      existingEntity.type.sourceMap.add(this.document, item);
      return;
    }

    this.scope.setProperty(
      identifier.name,
      new UnknownType(this.typeStorage, this.document, this.scope, item)
    );
  }

  aggregate(): void {
    for (let index = 0; index < this.block.definitions.length; index++) {
      const item = this.block.definitions[index];

      switch (item.type) {
        case ASTType.AssignmentStatement: {
          this.aggregateAssignmentStatement(item as ASTAssignmentStatement);
          break;
        }
        case ASTType.ForGenericStatement: {
          this.aggregateForGenericStatement(item as ASTForGenericStatement);
          break;
        }
        case GreybelASTType.FeatureImportExpression: {
          this.aggregateImportDefinition(item as ASTFeatureImportExpression);
          break;
        }
      }
    }
  }
}
