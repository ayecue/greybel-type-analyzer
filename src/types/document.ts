import type { ASTBase, ASTBaseBlockWithScope, ASTChunk } from 'miniscript-core';

import type { IChunkHelper } from './ast';
import { CompletionItemKind } from './completion';
import type { IScope, IScopeMetadata } from './scope';
import type { ITypeStorage } from './storage';
import type {
  IEntityInfo,
  IFunctionType,
  IType,
  SymbolInfo,
  TypeSource
} from './type';
import type { ITypeManager } from './type-manager';

export interface OnRequestScopeCallback {
  (item: ASTBaseBlockWithScope): void;
}

export interface IDocumentMergeItemNamespace {
  exportFrom: string;
  namespace: string;
}

export interface IDocumentMergeItem {
  readonly document: IDocument;
  readonly namespaces?: IDocumentMergeItemNamespace[];
}

export interface IResolveNamespaceResult {
  item: IType;
  path: string;
  value: string | null;
  completionItemKind: CompletionItemKind;
  sources: TypeSource[] | null;
}

export interface IDocument {
  readonly name: string;
  readonly typeStorage: ITypeStorage;
  readonly globals: IScope;
  readonly chunk: ASTChunk;
  readonly chunkHelper: IChunkHelper;
  readonly typeManager: ITypeManager;

  readonly scopes: IScopeMetadata[];
  readonly scopeRefMapping: WeakMap<ASTBaseBlockWithScope, IScopeMetadata>;
  readonly scopeFnMapping: WeakMap<IType, IScopeMetadata>;

  aggregateScopes(): void;
  aggregateDefinition(item: ASTBaseBlockWithScope): void;
  aggregateDefinitions(): void;
  attachFunctionTypeToScope(
    item: ASTBaseBlockWithScope,
    type: IFunctionType
  ): void;
  merge(...items: IDocumentMergeItem[]): IDocument;

  resolveAllAssignmentsWithQuery(query: string): SymbolInfo[];
  resolveAvailableAssignments(item: ASTBase): SymbolInfo[];
  resolvePath(path: string[]): IEntityInfo | undefined;
  resolveNamespace(
    item: ASTBase,
    invoke: boolean
  ): IResolveNamespaceResult | null;
}
