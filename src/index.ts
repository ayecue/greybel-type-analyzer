// Main TypeManager and options
export { TypeManager, type TypeManagerOptions } from './type-manager';

// Core entity classes
export { Type } from './entities/type';
export { ClassType } from './entities/class-type';
export { FunctionType } from './entities/function-type';
export { ListType } from './entities/list-type';
export { MapType } from './entities/map-type';
export { UnionType } from './entities/union-type';
export { EntityInfo } from './entities/entity-info';
export { KeyType } from './entities/key-type';
export { Document } from './entities/document';
export { Scope } from './entities/scope';

// Storage classes
export { TypeStorage } from './storage/type-storage';
export { GlobalTypeStorage } from './storage/global-type-storage';
export { DocumentTypeStorage } from './storage/document-type-storage';

// Inference classes
export { InferBase } from './inference/infer-base';
export { InferContext } from './inference/infer-context';
export { InferFullExpression } from './inference/infer-full-expression';
export { InferLightExpression } from './inference/infer-light-expression';

// Aggregator classes
export { ASTDefinitionAggregator } from './aggregator/ast-definition-aggregator';
export { ASTSignatureAggregator } from './aggregator/ast-signature-aggregator';

// Type interfaces and enums
export type {
  ISourceMap,
  IType,
  IKeyType,
  IMapType,
  IClassType,
  IUnknownType,
  IFunctionType,
  IListType,
  IUnionType,
  IEntityInfo,
  TypeId,
  KeyValue,
  TypeSource,
  PropertyInfo,
  SymbolInfo
} from './types/type';

export {
  TypeKind,
  MAX_ALL_PROPERTIES_DEPTH,
  NIL_TYPE_ID,
  UNKNOWN_TYPE_ID,
  ISA_PROPERTY,
  DEFAULT_SIGNATURE_ORIGIN,
  DEFAULT_SOURCE_DOCUMENT_ID,
  META_DOCS_SIGNATURE_ORIGIN,
  BASE_TYPE_SET,
  isKeyType,
  isValidKeyValue,
  isMapType,
  isClassType,
  isFunctionType,
  isListType,
  isUnionType,
  isUnknownType
} from './types/type';

// Storage interfaces
export type { ITypeStorage } from './types/storage';

// Document interfaces
export type {
  IDocument,
  IDocumentMergeItem,
  IDocumentMergeItemNamespace,
  IResolveNamespaceResult,
  OnRequestScopeCallback
} from './types/document';

// Scope interfaces
export type { IScope, IScopeMetadata } from './types/scope';
export { ScopeState } from './types/scope';

// Type manager interfaces
export type {
  ITypeManager,
  ModifyTypeStorageCallback,
  ModifyTypeStorageMergeCallback
} from './types/type-manager';
export { MAX_DEPTH } from './types/type-manager';

// Inference types and enums
export type { IInferContext } from './types/inference';
export {
  DEFAULT_CUSTOM_FUNCTION_DESCRIPTION,
  ConstantIdentifier,
  ConstantIdentifierSet,
  UnaryType,
  PathType
} from './types/inference';

// Completion enums and interfaces
export { CompletionItemKind } from './types/completion';
export type { CompletionItem } from './types/completion';

// AST types
export type { IChunkHelper } from './types/ast';

// Utility classes and functions
export { ChunkHelper } from './utils/chunk-helper';
export { createCommentBlock } from './utils/create-comment-block';
export { determineTypeFromMeta } from './utils/determine-type-from-meta';
export { enrichWithMetaInformation } from './utils/enrich-with-meta-information';
export { mergeScope, deepMerge, shallowMergeList, shallowMergeMap } from './utils/merge-helper';
export { SourceMap } from './utils/source-map';
export { isTypeMetaEqual, isSignatureDefinitionEqual } from './utils/meta-helper';
export { createProxyForNativeType, persistTypeInNativeFunction } from './utils/native-type-helper';
export { normalizeText } from './utils/normalize-text';
export { parseAssignDescription } from './utils/parse-assign-description';
export { parseMapDescription } from './utils/parse-map-description';