import {
  SignatureDefinitionBaseType,
  SignaturePayloadDefinitionType
} from 'meta-utils';
import { ASTBase } from 'miniscript-core';

import { IDocument } from '../types/document';
import { IScope } from '../types/scope';
import { ITypeStorage } from '../types/storage';
import {
  IListType,
  isListType,
  isUnionType,
  IType,
  KeyValue,
  MAX_TO_META_DEPTH,
  TypeKind,
  UNKNOWN_TYPE_ID
} from '../types/type';
import { simplifyForMeta } from '../utils/native-type-helper';
import { EntityInfo } from './entity-info';
import { Type } from './type';
import { UnionType } from './union-type';

export class ListType extends Type implements IListType {
  public elementType: Type;

  constructor(
    id: string,
    elementType: Type,
    typeStorage: ITypeStorage,
    document?: IDocument,
    scope?: IScope,
    astRef?: ASTBase
  ) {
    super(
      id,
      TypeKind.ListType,
      SignatureDefinitionBaseType.List,
      typeStorage,
      document,
      scope,
      astRef
    );
    this.elementType =
      elementType ??
      Type.createBaseType(UNKNOWN_TYPE_ID, typeStorage, document, scope);
  }

  referenceEqualsTo(anotherType: IListType): boolean {
    if (!isListType(anotherType)) return false;
    return (
      this === anotherType ||
      (this.id === anotherType.id &&
        this.elementType.referenceEqualsTo(anotherType.elementType))
    );
  }

  equalsTo(anotherType: IListType): boolean {
    if (!isListType(anotherType)) return false;
    return (
      this.referenceEqualsTo(anotherType) ||
      (this.id === anotherType.id &&
        this.elementType.equalsTo(anotherType.elementType))
    );
  }

  addElementType(valueType: IType): void {
    if (valueType == null) return;

    const incomingValueType = Type.simplify(valueType);

    if (this.elementType.id === UNKNOWN_TYPE_ID) {
      this.elementType = incomingValueType.copy(
        true,
        true,
        this.typeStorage,
        this.document,
        this.scope
      );
      return;
    }
    if (incomingValueType.equalsTo(this.elementType)) return;
    if (!isUnionType(this.elementType)) {
      this.elementType = new UnionType(
        this.typeStorage.generateId(TypeKind.UnionType),
        [this.elementType],
        this.typeStorage,
        this.document,
        this.scope,
        null
      );
    }

    const mapValueType = this.elementType as UnionType;
    mapValueType.addVariant(incomingValueType);
  }

  getProperty(key: KeyValue, depth: number = 1): EntityInfo | undefined {
    if (
      typeof key !== 'string' &&
      key.id === SignatureDefinitionBaseType.Number
    ) {
      return new EntityInfo(key.id, this.elementType);
    }
    return super.getProperty(key, depth + 1);
  }

  copy(
    keepSource: boolean,
    _unbind: boolean,
    typeStorage?: ITypeStorage,
    document?: IDocument,
    scope?: IScope,
    astRef?: ASTBase
  ): Type {
    const copiedList = new ListType(
      this.id,
      this.elementType.copy(
        keepSource,
        true,
        typeStorage,
        document,
        scope,
        astRef
      ),
      typeStorage || this.typeStorage,
      document || this.document,
      scope || this.scope,
      astRef
    );

    if (keepSource) {
      copiedList.sourceMap.extend(this.sourceMap);
    }

    return copiedList;
  }

  merge(source: IType): void {
    if (!isListType(source)) {
      return;
    }

    this.addElementType(source.elementType);
    this.sourceMap.extend(source.sourceMap);
  }

  toMeta(depth: number = 1): SignaturePayloadDefinitionType[] {
    if (depth > MAX_TO_META_DEPTH) {
      return [
        {
          type: SignatureDefinitionBaseType.List,
          valueType: SignatureDefinitionBaseType.Any
        }
      ];
    }
    const elementTypeMeta = simplifyForMeta(this.elementType).flatMap((it) =>
      it.toMeta(depth + 1)
    );

    return elementTypeMeta.flatMap((valueType) => {
      return {
        type: SignatureDefinitionBaseType.List,
        valueType
      };
    });
  }
}
