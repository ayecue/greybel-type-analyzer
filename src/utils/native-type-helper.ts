import { SignatureDefinitionType } from 'meta-utils';

import { ClassType } from '../entities/class-type';
import { IDocument } from '../types/document';
import { ITypeStorage } from '../types/storage';
import {
  IClassType,
  IFunctionType,
  IKeyType,
  isFunctionType,
  isUnionType,
  IType
} from '../types/type';

export function createProxyForNativeType(
  type: SignatureDefinitionType,
  document: IDocument
): IClassType {
  return new ClassType(
    type,
    null,
    type,
    document.typeStorage,
    document,
    document.globals
  );
}

export function persistTypeInNativeFunction(
  type: SignatureDefinitionType,
  property: string,
  returnType: IType,
  document: IDocument,
  globalTypeStorage: ITypeStorage
): IFunctionType {
  const native = globalTypeStorage.getTypeById(type);

  if (native == null) {
    throw new Error(`Native type ${type} not found in global type storage.`);
  }

  const propertyType = native.getProperty(property);

  if (propertyType == null) {
    throw new Error(`Property ${property} not found in native type ${type}.`);
  }

  if (!isFunctionType(propertyType.type)) {
    throw new Error(
      `Property ${property} in native type ${type} is not a function type.`
    );
  }

  const proxyFn = propertyType.type.copy(
    false,
    true,
    document.typeStorage
  ) as IFunctionType;

  proxyFn.returnType = returnType;
  proxyFn.isPersistent = true;

  return proxyFn;
}

export function simplifyForMeta(type: IType): IType[] {
  if (!isUnionType(type)) {
    return [type];
  }

  const visited = new Set<IKeyType>();
  const allowedVariants: IType[] = [];

  for (let index = 0; index < type.variants.length; index++) {
    const variant = type.variants[index];
    const keyType = variant.getKeyType();
    if (keyType == null) continue;
    if (visited.has(keyType)) continue;
    visited.add(keyType);
    allowedVariants.push(variant);
  }

  return allowedVariants;
}
