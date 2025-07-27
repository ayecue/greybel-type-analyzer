import {
  type Signature,
  type SignatureDefinition,
  SignatureDefinitionBaseType,
  SignatureDefinitionFunction,
  SignatureDefinitionType,
  SignaturePayloadDefinitionType
} from 'meta-utils';
import type { ASTBase, ASTPosition } from 'miniscript-core';

import { CompletionItemKind } from './completion';
import type { IDocument } from './document';
import type { IScope } from './scope';
import type { ITypeStorage } from './storage';

export type TypeId = string;
export const MAX_ALL_PROPERTIES_DEPTH = 10;
export const MAX_TO_META_DEPTH = 3;
export const NIL_TYPE_ID: TypeId = 'null' as const;
export const UNKNOWN_TYPE_ID: TypeId = 'unknown' as const;
export const ISA_PROPERTY: string = '__isa' as const;
export const DEFAULT_SIGNATURE_ORIGIN: string = 'custom' as const;
export const META_DOCS_SIGNATURE_ORIGIN: string = 'metadocs' as const;
export const BASE_TYPE_SET = new Set(
  Object.values(SignatureDefinitionBaseType)
);

export enum TypeKind {
  Base,
  KeyType,
  MapType,
  ClassType,
  FunctionType,
  ListType,
  UnionType,
  UnknownType
}

export type KeyValue = string | IKeyType;
export type TypeSource = {
  document?: string;
  astRef: ASTBase;
  start: ASTPosition;
  end: ASTPosition;
};
export const DEFAULT_SOURCE_DOCUMENT_ID = 'unknown' as const;

export interface ISourceMap {
  readonly size: number;
  add(document: IDocument | undefined, astRef: ASTBase): this;
  extend(other: ISourceMap): this;
  getAllSources(): TypeSource[];
  clear(): this;
}

export type PropertyInfo = {
  type: IType;
  name: string;
  kind: CompletionItemKind;
};
export type SymbolInfo = {
  name: string;
  path: string;
  kind: CompletionItemKind;
  source: TypeSource[];
  assignmentRef: ASTBase;
};

export interface IType {
  readonly id: TypeId;
  readonly inheritFrom: SignatureDefinitionType | null;
  readonly kind: TypeKind;
  readonly sourceMap: ISourceMap;

  // reference to the document and scope where this type is defined
  typeStorage: ITypeStorage;
  document?: IDocument;
  scope?: IScope;
  astRef?: ASTBase;

  referenceEqualsTo(anotherType: IType): boolean;
  equalsTo(anotherType: IType): boolean;
  getKeyType(): IKeyType | null;

  setProperty(key: KeyValue, info: IEntityInfo): void;
  getProperty(key: KeyValue, depth?: number): IEntityInfo | undefined;
  hasProperty(key: KeyValue): boolean;
  containsOwnProperties(): boolean;
  getAllProperties(depth?: number): PropertyInfo[];

  reset(
    typeStorage?: ITypeStorage,
    document?: IDocument,
    scope?: IScope,
    astRef?: ASTBase
  ): IType;
  invoke(
    typeStorage?: ITypeStorage,
    document?: IDocument,
    scope?: IScope,
    astRef?: ASTBase
  ): IType;
  deepCopy(
    keepSource: boolean,
    typeStorage?: ITypeStorage,
    document?: IDocument,
    scope?: IScope,
    astRef?: ASTBase,
    refs?: WeakMap<IType, IType>
  ): IType;
  copy(
    keepSource: boolean,
    unbind: boolean,
    typeStorage?: ITypeStorage,
    document?: IDocument,
    scope?: IScope,
    astRef?: ASTBase
  ): IType;
  merge(source: IType): void;
  getSource(): TypeSource[] | null;
  addToSource(type: IType): void;
  toMeta(depth?: number): SignaturePayloadDefinitionType[];
}

export function isBaseType(type: IType): type is IType {
  return type.kind === TypeKind.Base;
}

export interface IKeyType extends IType {
  readonly isUserDefined: boolean;
}

export function isKeyType(type: IType): type is IKeyType {
  return type.kind === TypeKind.KeyType;
}

export function isValidKeyValue(value: string | IKeyType): boolean {
  return typeof value === 'string' || isKeyType(value);
}

export interface IEntityInfo<T extends IType = IType> {
  readonly name: string;
  type: T;
}

export interface IMapType extends IType {
  readonly properties: Map<KeyValue, IEntityInfo>;
  readonly isScope: boolean;
  keyType: IType;
  valueType: IType;

  addKeyVariant(keyType: KeyValue): void;
  addValueVariant(valueType: IType): void;
  setPropertyInPath(path: string[], value: IEntityInfo): void;
  getPropertyInPath(path: string[]): IEntityInfo | undefined;
}

export function isMapType(type: IType): type is IMapType {
  return type.kind === TypeKind.MapType;
}

export interface IClassType extends IType {
  readonly properties: Map<string, IEntityInfo>;
  readonly associatedMap: IMapType | null;

  insertDefinition(property: string, definition: SignatureDefinition): void;
  insertSignature(signature: Signature): void;
}

export function isClassType(type: IType): type is IClassType {
  return type.kind === TypeKind.ClassType;
}

export interface IFunctionType extends IType {
  readonly signature: SignatureDefinitionFunction;
  context?: IType;
  returnType: IType | null;
  isPersistent?: boolean;

  getReturnType(typeStorage?: ITypeStorage): IType;
}

export function isFunctionType(type: IType): type is IFunctionType {
  return type.kind === TypeKind.FunctionType;
}

export interface IListType extends IType {
  elementType: IType;

  addElementType(valueType: IType): void;
}

export function isListType(type: IType): type is IListType {
  return type.kind === TypeKind.ListType;
}

export interface IUnionType extends IType {
  readonly variants: IType[];

  containsVariant(type: IType): boolean;
  addVariant(type: IType): void;
}

export function isUnionType(type: IType): type is IUnionType {
  return type.kind === TypeKind.UnionType;
}

export interface IUnknownType extends IType {
  assumedId: string;
  signature?: SignatureDefinition;
  properties?: Map<string, IEntityInfo>;
  keyType?: IType;
  valueType?: IType;

  mergeIntoType(type: IType): void;
  getKind(): TypeKind;
}

export function isUnknownType(type: IType): type is IUnknownType {
  return type.kind === TypeKind.UnknownType;
}
