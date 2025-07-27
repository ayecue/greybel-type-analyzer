import {
  SignatureDefinitionBaseType,
  SignatureDefinitionTypeMeta
} from 'meta-utils';
import { ASTBase } from 'miniscript-core';

import { ListType } from '../entities/list-type';
import { MapType } from '../entities/map-type';
import { Type } from '../entities/type';
import { UnknownType } from '../entities/unknown-type';
import { IDocument } from '../types/document';
import { IScope } from '../types/scope';
import { ITypeStorage } from '../types/storage';
import { NIL_TYPE_ID, TypeKind, UNKNOWN_TYPE_ID } from '../types/type';

export function determineTypeFromMeta(
  type: SignatureDefinitionTypeMeta,
  typeStorage: ITypeStorage,
  document: IDocument,
  scope: IScope,
  astRef?: ASTBase
): Type {
  switch (type.type) {
    case SignatureDefinitionBaseType.List: {
      const elementType = type.valueType
        ? determineTypeFromMeta(
            type.valueType,
            typeStorage,
            document,
            scope,
            astRef
          )
        : Type.createBaseType(
            SignatureDefinitionBaseType.Any,
            typeStorage,
            document,
            scope,
            astRef
          );
      return new ListType(
        typeStorage.generateId(TypeKind.ListType, astRef),
        elementType,
        typeStorage,
        document,
        scope,
        astRef
      );
    }
    case SignatureDefinitionBaseType.Map: {
      const keyType = type.keyType
        ? determineTypeFromMeta(
            type.keyType,
            typeStorage,
            document,
            scope,
            astRef
          )
        : Type.createBaseType(
            SignatureDefinitionBaseType.Any,
            typeStorage,
            document,
            scope,
            astRef
          );
      const valueType = type.valueType
        ? determineTypeFromMeta(
            type.valueType,
            typeStorage,
            document,
            scope,
            astRef
          )
        : Type.createBaseType(
            SignatureDefinitionBaseType.Any,
            typeStorage,
            document,
            scope,
            astRef
          );
      return new MapType(
        typeStorage.generateId(TypeKind.MapType, astRef),
        keyType,
        valueType,
        typeStorage,
        document,
        scope,
        null,
        astRef
      );
    }
    case SignatureDefinitionBaseType.Any:
    case UNKNOWN_TYPE_ID: {
      return new UnknownType(typeStorage, document, scope, astRef);
    }
    case NIL_TYPE_ID:
    case SignatureDefinitionBaseType.Number:
    case SignatureDefinitionBaseType.String:
    case SignatureDefinitionBaseType.Function:
    default: {
      return Type.createBaseType(
        type.type,
        typeStorage,
        document,
        scope,
        astRef
      );
    }
  }
}
