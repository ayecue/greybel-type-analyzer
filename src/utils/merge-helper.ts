import { ASTBase } from 'miniscript-core';

import { EntityInfo } from '../entities/entity-info';
import { ListType } from '../entities/list-type';
import { MapType } from '../entities/map-type';
import { UnionType } from '../entities/union-type';
import { IDocumentMergeItemNamespace } from '../types/document';
import { IScope } from '../types/scope';
import { ITypeStorage } from '../types/storage';
import {
  IClassType,
  IFunctionType,
  IMapType,
  isClassType,
  isFunctionType,
  isListType,
  isMapType,
  isUnionType,
  isUnknownType,
  IType,
  IUnionType,
  IUnknownType
} from '../types/type';

export function shallowMergeMap(
  target: IType,
  source: IType,
  astRef?: ASTBase
): IType {
  if (!isMapType(target) || !isMapType(source)) {
    return target;
  }

  const copiedTarget = target.copy(false, true) as MapType;
  const mergedMap = new MapType(
    target.id,
    copiedTarget.keyType,
    copiedTarget.valueType,
    copiedTarget.typeStorage,
    copiedTarget.document,
    copiedTarget.scope,
    null,
    astRef
  );

  // @ts-expect-error
  mergedMap.properties = copiedTarget.properties;

  for (const [key, value] of source.properties) {
    mergedMap.setProperty(
      key,
      new EntityInfo(
        value.name,
        value.type.copy(false, true, copiedTarget.typeStorage)
      )
    );
  }

  return mergedMap;
}

export function shallowMergeList(
  target: IType,
  source: IType,
  astRef?: ASTBase
): IType {
  if (!isListType(target) || !isListType(source)) {
    return target;
  }

  const copiedTarget = target.copy(false, true) as MapType;
  const mergedList = new ListType(
    target.id,
    copiedTarget.keyType,
    copiedTarget.typeStorage,
    copiedTarget.document,
    copiedTarget.scope,
    astRef
  );

  mergedList.addElementType(source.elementType);

  return mergedList;
}

function deepMergeTypesWithProperties(
  typeStorage: ITypeStorage,
  target: IMapType | IClassType | IUnknownType,
  source: IMapType | IClassType | IUnknownType,
  refs: WeakSet<IType>
): IMapType | IClassType | IUnknownType {
  refs.add(target);
  refs.add(source);

  if (target.properties == null && source.properties == null) {
    return target;
  } else if (target.properties == null) {
    return source;
  } else if (source.properties == null) {
    return target;
  }

  const isAllowedToUseTypeAsKey = isMapType(target);

  for (const [key, value] of source.properties) {
    if (!isAllowedToUseTypeAsKey && typeof key !== 'string') continue;
    const targetValue = target.properties.get(key as string);
    if (targetValue) {
      target.setProperty(
        key,
        new EntityInfo(
          targetValue.name,
          deepMerge(typeStorage, targetValue.type, value.type, refs)
        )
      );
    } else {
      target.setProperty(
        key,
        new EntityInfo(value.name, value.type.copy(true, true, typeStorage))
      );
    }
  }

  return target;
}

function deepMergeFunctions(
  typeStorage: ITypeStorage,
  target: IFunctionType,
  source: IFunctionType,
  refs: WeakSet<IType>
): IFunctionType {
  if (target.returnType != null && source.returnType != null) {
    target.returnType = deepMerge(
      typeStorage,
      target.returnType,
      source.returnType,
      refs
    );
  } else if (source.returnType != null) {
    target.returnType = source.returnType.copy(true, true, typeStorage);
  }
  return target;
}

function deepMergeUnions(
  typeStorage: ITypeStorage,
  target: IUnionType,
  source: IUnionType
): IUnionType {
  for (const variant of source.variants) {
    target.addVariant(variant.copy(true, true, typeStorage));
  }
  return target;
}

export function deepMerge(
  typeStorage: ITypeStorage,
  target: IType,
  source: IType,
  refs: WeakSet<IType> = new WeakSet()
): IType {
  if (target === source) return target;
  if (refs.has(target) || refs.has(source)) {
    return target;
  }
  refs.add(target);
  refs.add(source);
  if (isMapType(target)) {
    if (isMapType(source))
      return deepMergeTypesWithProperties(typeStorage, target, source, refs);
    else if (isUnknownType(source))
      return deepMergeTypesWithProperties(typeStorage, target, source, refs);
    else if (isClassType(source))
      return deepMergeTypesWithProperties(typeStorage, target, source, refs);
    else if (isUnionType(source)) {
      const copiedUnion = source.copy(true, true, typeStorage) as IUnionType;
      copiedUnion.addVariant(target);
      refs.add(copiedUnion);
      return copiedUnion;
    }
  } else if (isClassType(target)) {
    if (isMapType(source))
      return deepMergeTypesWithProperties(typeStorage, target, source, refs);
    else if (isUnknownType(source))
      return deepMergeTypesWithProperties(typeStorage, target, source, refs);
    else if (isClassType(source))
      return deepMergeTypesWithProperties(typeStorage, target, source, refs);
    else if (isUnionType(source)) {
      const copiedUnion = source.copy(true, true, typeStorage) as IUnionType;
      copiedUnion.addVariant(target);
      refs.add(copiedUnion);
      return copiedUnion;
    }
  } else if (isUnknownType(target)) {
    if (isMapType(source))
      return deepMergeTypesWithProperties(
        typeStorage,
        source.copy(true, true, typeStorage) as IMapType,
        target,
        refs
      );
    else if (isUnknownType(source))
      return deepMergeTypesWithProperties(typeStorage, target, source, refs);
    else if (isClassType(source))
      return deepMergeTypesWithProperties(
        typeStorage,
        source.copy(true, true, typeStorage) as IClassType,
        target,
        refs
      );
    else if (isUnionType(source)) {
      const copiedUnion = source.copy(true, true, typeStorage) as IUnionType;
      copiedUnion.variants.forEach((variant) =>
        deepMerge(typeStorage, variant, target, refs)
      );
      refs.add(copiedUnion);
      return copiedUnion;
    }
    return source.copy(true, true, typeStorage);
  } else if (isFunctionType(target)) {
    if (isFunctionType(source))
      return deepMergeFunctions(typeStorage, target, source, refs);
  } else if (isUnionType(target)) {
    if (isUnionType(source))
      return deepMergeUnions(typeStorage, target, source);
    target.addVariant(source.copy(true, true, typeStorage));
    return target;
  }

  if (!source.equalsTo(target)) {
    const union = UnionType.createDefault(
      typeStorage,
      target.document,
      target.scope
    );
    refs.add(union);
    union.addVariant(target);
    union.addVariant(source.copy(true, true, typeStorage));
    return union;
  }

  return target;
}

export function mergeScope(
  typeStorage: ITypeStorage,
  target: IScope,
  source: IScope,
  namespaces?: IDocumentMergeItemNamespace[]
): void {
  if (namespaces) {
    // only merge namespaces if they are defined
    for (let index = 0; index < namespaces.length; index++) {
      const item = namespaces[index];
      const targetValue = target.locals.getProperty(item.namespace);
      const sourceValue = source.locals.getPropertyInPath(
        item.exportFrom.split('.')
      );

      if (sourceValue != null && targetValue != null) {
        target.locals.setProperty(
          item.namespace,
          new EntityInfo(
            targetValue.name,
            deepMerge(typeStorage, targetValue.type, sourceValue.type)
          )
        );
      } else if (sourceValue != null && targetValue == null) {
        target.locals.setProperty(
          item.namespace,
          new EntityInfo(
            sourceValue.name,
            sourceValue.type.copy(true, true, typeStorage)
          )
        );
      }
    }
    return;
  }

  const refs = new Map<IType, IType>();

  // merge all globals from the external document
  for (const [sourceKey, sourceValue] of source.locals.properties) {
    const targetValue = target.locals.getProperty(sourceKey);
    if (targetValue != null) {
      target.locals.setProperty(
        sourceKey,
        new EntityInfo(
          targetValue.name,
          deepMerge(typeStorage, targetValue.type, sourceValue.type)
        )
      );
    } else {
      target.locals.setProperty(
        sourceKey,
        new EntityInfo(
          sourceValue.name,
          sourceValue.type.deepCopy(true, typeStorage, null, null, null, refs)
        )
      );
    }
  }
}
