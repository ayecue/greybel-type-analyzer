import {
  SignatureDefinitionBaseType,
  SignatureDefinitionType,
  SignaturePayloadDefinitionType
} from 'meta-utils';
import { ASTBase } from 'miniscript-core';

import { IDocument } from '../types/document';
import { IScope } from '../types/scope';
import { ITypeStorage } from '../types/storage';
import {
  IKeyType,
  ISourceMap,
  IType,
  KeyValue,
  MAX_ALL_PROPERTIES_DEPTH,
  PropertyInfo,
  TypeKind,
  TypeSource
} from '../types/type';
import { MAX_DEPTH } from '../types/type-manager';
import { SourceMap } from '../utils/source-map';
import { EntityInfo } from './entity-info';

export class Type implements IType {
  public readonly kind: TypeKind;
  public readonly id: string;
  public readonly sourceMap: ISourceMap;
  public readonly inheritFrom: SignatureDefinitionType | null;

  public typeStorage: ITypeStorage;
  public document?: IDocument;
  public scope?: IScope;
  public astRef?: ASTBase;

  static createBaseType(
    id: string,
    typeStorage: ITypeStorage,
    document?: IDocument,
    scope?: IScope,
    astRef?: ASTBase
  ): Type {
    return new Type(
      id,
      TypeKind.Base,
      id,
      typeStorage,
      document,
      scope,
      astRef
    );
  }

  static simplify(type: IType): Type {
    const simplifiedId =
      type.getKeyType()?.id || SignatureDefinitionBaseType.Any;

    return new Type(
      simplifiedId,
      TypeKind.Base,
      simplifiedId,
      type.typeStorage,
      type.document,
      type.scope,
      type.astRef
    );
  }

  constructor(
    id: string,
    kind: TypeKind,
    inheritFrom: SignatureDefinitionType | null = null,
    typeStorage: ITypeStorage,
    document?: IDocument,
    scope?: IScope,
    astRef?: ASTBase
  ) {
    this.id = id;
    this.kind = kind;
    this.inheritFrom = inheritFrom;
    this.typeStorage = typeStorage;
    this.document = document;
    this.scope = scope;
    this.astRef = astRef;
    this.sourceMap = astRef
      ? new SourceMap().add(document, astRef)
      : new SourceMap();
  }

  referenceEqualsTo(anotherType: Type) {
    return this === anotherType;
  }

  equalsTo(anotherType: Type) {
    return this.referenceEqualsTo(anotherType) || this.id === anotherType.id;
  }

  getKeyType(): IKeyType | null {
    return this.typeStorage.getKeyType(this);
  }

  setProperty(_key: KeyValue, _info: EntityInfo): void {
    /* ignore set */
  }

  getProperty(key: KeyValue, depth: number = 1): EntityInfo | undefined {
    if (depth > MAX_DEPTH) return;
    if (typeof key !== 'string') return;
    if (this.inheritFrom == null) return;
    const inerhitType = this.typeStorage.getTypeById(this.inheritFrom);
    return inerhitType?.getProperty(key, depth + 1);
  }

  hasProperty(key: KeyValue): boolean {
    if (typeof key !== 'string') return;
    const type = this.typeStorage.getTypeById(this.inheritFrom);
    if (type == null) return;
    return type.hasProperty(key);
  }

  containsOwnProperties(): boolean {
    return false;
  }

  getAllProperties(depth: number = 1): PropertyInfo[] {
    if (depth > MAX_ALL_PROPERTIES_DEPTH) return [];
    const type = this.inheritFrom
      ? this.typeStorage.getTypeById(this.inheritFrom)
      : null;
    return type?.getAllProperties(depth + 1) || [];
  }

  reset(
    typeStorage?: ITypeStorage,
    document?: IDocument,
    scope?: IScope,
    astRef?: ASTBase
  ): IType {
    this.typeStorage = typeStorage || this.typeStorage;
    this.document = document || this.document;
    this.scope = scope || this.scope;
    this.astRef = astRef || this.astRef;
    this.sourceMap.clear().add(this.document, this.astRef);
    return this;
  }

  invoke(
    _typeStorage?: ITypeStorage,
    _document?: IDocument,
    _scope?: IScope,
    _astRef?: ASTBase
  ): IType {
    return this;
  }

  deepCopy(
    keepSource: boolean,
    typeStorage?: ITypeStorage,
    document?: IDocument,
    scope?: IScope,
    astRef?: ASTBase,
    _refs?: WeakMap<IType, IType>
  ): IType {
    return this.copy(keepSource, true, typeStorage, document, scope, astRef);
  }

  copy(
    keepSource: boolean,
    _unbind: boolean,
    typeStorage?: ITypeStorage,
    document?: IDocument,
    scope?: IScope,
    astRef?: ASTBase
  ): Type {
    const copiedInstance = new Type(
      this.id,
      this.kind,
      this.inheritFrom,
      typeStorage || this.typeStorage,
      document || this.document,
      scope || this.scope,
      astRef
    );

    if (keepSource) {
      copiedInstance.sourceMap.extend(this.sourceMap);
    }

    return copiedInstance;
  }

  merge(source: IType): void {
    /* nothing to do */
    this.sourceMap.extend(source.sourceMap);
  }

  getSource(): TypeSource[] | null {
    if (this.sourceMap.size === 0) return null;
    return this.sourceMap.getAllSources();
  }

  addToSource(type: IType): void {
    this.sourceMap.extend(type.sourceMap);
  }

  toMeta(_depth?: number): SignaturePayloadDefinitionType[] {
    return [{ type: this.getKeyType()?.id || SignatureDefinitionBaseType.Any }];
  }
}
