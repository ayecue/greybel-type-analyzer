import {
  SignatureDefinitionBaseType,
  SignaturePayloadDefinitionType
} from 'meta-utils';
import { ASTBase } from 'miniscript-core';

import { CompletionItemKind } from '../types/completion';
import { IDocument } from '../types/document';
import { IScope } from '../types/scope';
import { ITypeStorage } from '../types/storage';
import {
  IMapType,
  ISA_PROPERTY,
  isFunctionType,
  isMapType,
  isUnionType,
  isUnknownType,
  isValidKeyValue,
  IType,
  KeyValue,
  MAX_ALL_PROPERTIES_DEPTH,
  MAX_TO_META_DEPTH,
  PropertyInfo,
  TypeKind,
  UNKNOWN_TYPE_ID
} from '../types/type';
import { MAX_DEPTH } from '../types/type-manager';
import { simplifyForMeta } from '../utils/native-type-helper';
import { EntityInfo } from './entity-info';
import { Type } from './type';
import { UnionType } from './union-type';

export class MapType extends Type implements IMapType {
  public readonly properties: Map<KeyValue, EntityInfo>;
  public readonly isScope: boolean;
  public keyType: Type;
  public valueType: Type;

  static createDefault(
    typeStorage: ITypeStorage,
    document?: IDocument,
    scope?: IScope
  ): MapType {
    return new MapType(
      typeStorage.generateId(TypeKind.MapType),
      null,
      null,
      typeStorage,
      document,
      scope,
      null
    );
  }

  constructor(
    id: string,
    keyType: Type,
    valueType: Type,
    typeStorage: ITypeStorage,
    document?: IDocument,
    scope?: IScope,
    properties?: Map<KeyValue, EntityInfo>,
    astRef?: ASTBase,
    isScope: boolean = false
  ) {
    super(
      id,
      TypeKind.MapType,
      SignatureDefinitionBaseType.Map,
      typeStorage,
      document,
      scope,
      astRef
    );
    this.properties = properties || new Map();
    this.keyType =
      keyType ??
      Type.createBaseType(UNKNOWN_TYPE_ID, typeStorage, document, scope);
    this.valueType =
      valueType ??
      Type.createBaseType(UNKNOWN_TYPE_ID, typeStorage, document, scope);
    this.isScope = isScope;
  }

  addKeyVariant(keyType: KeyValue): void {
    const incomingKeyType =
      typeof keyType === 'string'
        ? Type.createBaseType(
            SignatureDefinitionBaseType.String,
            this.typeStorage,
            this.document,
            this.scope
          )
        : Type.simplify(keyType);

    if (this.keyType.id === UNKNOWN_TYPE_ID) {
      this.keyType = incomingKeyType.copy(
        true,
        true,
        this.typeStorage,
        this.document,
        this.scope
      );
      return;
    }
    if (incomingKeyType.equalsTo(this.keyType)) return;
    if (!isUnionType(this.keyType)) {
      this.keyType = new UnionType(
        this.typeStorage.generateId(TypeKind.UnionType),
        [this.keyType],
        this.typeStorage,
        this.document,
        this.scope,
        null
      );
    }

    const mapKeyType = this.keyType as UnionType;
    mapKeyType.addVariant(incomingKeyType);
  }

  addValueVariant(valueType: IType): void {
    if (valueType == null) return;

    const incomingValueType = Type.simplify(valueType);

    if (this.valueType.id === UNKNOWN_TYPE_ID) {
      this.valueType = incomingValueType.copy(
        true,
        true,
        this.typeStorage,
        this.document,
        this.scope
      );
      return;
    }
    if (incomingValueType.equalsTo(this.valueType)) return;
    if (!isUnionType(this.valueType)) {
      this.valueType = new UnionType(
        this.typeStorage.generateId(TypeKind.UnionType),
        [this.valueType],
        this.typeStorage,
        this.document,
        this.scope,
        null
      );
    }

    const mapValueType = this.valueType as UnionType;
    mapValueType.addVariant(incomingValueType);
  }

  setPropertyInPath(path: string[], info: EntityInfo): void {
    if (path.length === 0) return;

    const queue = [...path];
    const lastKey = queue.pop();
    let current: IType = this;
    let previous: IType = null;

    while (queue.length > 0) {
      if (!current.containsOwnProperties()) {
        return;
      }

      const currentPath = queue.shift()!;
      previous = current;
      current = current.getProperty(currentPath)?.type;
      if (current == null) {
        const newProperty = MapType.createDefault(
          this.typeStorage,
          this.document,
          this.scope
        );
        previous.setProperty(
          currentPath,
          new EntityInfo(currentPath, newProperty)
        );
        current = newProperty;
      }
    }

    current.setProperty(lastKey!, info);
  }

  getPropertyInPath(path: string[]): EntityInfo | undefined {
    if (path.length === 0) return;

    const queue = [...path];
    let current: IType = this;
    let lastInfo: EntityInfo | undefined;

    while (queue.length > 0) {
      const currentPath = queue.shift()!;
      const nextInfo = current.getProperty(currentPath);
      if (nextInfo == null) {
        return null;
      }
      lastInfo = nextInfo;
      current = lastInfo.type;
    }

    return lastInfo;
  }

  setProperty(key: KeyValue, info: EntityInfo): void {
    if (!isValidKeyValue(key)) {
      throw new Error(`Invalid key type: ${key}`);
    }

    this.addKeyVariant(key);
    this.addValueVariant(info.type);

    const existingInfo = this.properties.get(key);

    if (existingInfo) {
      if (isUnknownType(existingInfo.type)) {
        existingInfo.type.mergeIntoType(info.type);
        this.properties.set(key, info);
      } else if (isUnknownType(info.type)) {
        info.type.mergeIntoType(existingInfo.type);
      } else if (isUnionType(existingInfo.type)) {
        existingInfo.type.addVariant(info.type);
      } else if (!info.type.equalsTo(existingInfo.type)) {
        existingInfo.type = new UnionType(
          this.typeStorage.generateId(TypeKind.UnionType),
          [existingInfo.type, info.type],
          this.typeStorage,
          this.document,
          this.scope
        );
      } else {
        existingInfo.type.addToSource(info.type);
      }

      return;
    }

    this.properties.set(key, info);
  }

  getProperty(key: KeyValue, depth: number = 1): EntityInfo | undefined {
    if (depth > MAX_DEPTH) return;
    const propertyType = this.properties.get(key);
    if (propertyType) return propertyType;
    const isaEntity = this.properties.get(ISA_PROPERTY);
    if (isaEntity != null) {
      const isaProperty = isaEntity.type.getProperty(key, depth + 1);
      if (isaProperty) return isaProperty;
    }
    if (this.inheritFrom == null) return;
    const inerhitType = this.typeStorage.getTypeById(this.inheritFrom);
    return inerhitType?.getProperty(key, depth + 1);
  }

  hasProperty(key: KeyValue): boolean {
    return this.properties.has(key);
  }

  containsOwnProperties(): boolean {
    return true;
  }

  getAllProperties(
    depth: number = 1
  ): PropertyInfo[] {
    if (depth > MAX_ALL_PROPERTIES_DEPTH) return [];
    const properties: Map<string, PropertyInfo> = new Map();

    for (const [key, info] of this.properties) {
      if (typeof key !== 'string') continue;
      if (!properties.has(key)) {
        properties.set(key, {
          type: info.type,
          name: info.name,
          kind: isFunctionType(info.type)
            ? CompletionItemKind.Function
            : this.isScope
              ? CompletionItemKind.Variable
              : CompletionItemKind.Property
        });
      }
    }

    const isaEntity = this.properties.get(ISA_PROPERTY);
    if (isaEntity != null) {
      for (const property of isaEntity.type.getAllProperties(depth + 1)) {
        if (!properties.has(property.name)) {
          properties.set(property.name, property);
        }
      }
    }

    if (this.inheritFrom) {
      const inerhitType = this.typeStorage.getTypeById(this.inheritFrom);
      for (const property of inerhitType.getAllProperties(depth + 1)) {
        if (!properties.has(property.name)) {
          properties.set(property.name, property);
        }
      }
    }

    return Array.from(properties.values());
  }

  deepCopy(
    keepSource: boolean,
    typeStorage?: ITypeStorage,
    document?: IDocument,
    scope?: IScope,
    astRef?: ASTBase,
    refs: WeakMap<IType, IType> = new WeakMap()
  ): IType {
    const existingCopy = refs.get(this);
    if (existingCopy) return existingCopy;

    const copiedMap = new MapType(
      this.id,
      this.keyType.copy(keepSource, true, typeStorage, document, scope, astRef),
      this.valueType.copy(
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
      new Map(),
      astRef,
      this.isScope
    );

    refs.set(this, copiedMap);

    for (const [key, info] of this.properties) {
      copiedMap.properties.set(
        key,
        new EntityInfo(
          info.name,
          info.type.deepCopy(
            keepSource,
            typeStorage,
            document,
            scope,
            null,
            refs
          )
        )
      );
    }

    if (keepSource) {
      copiedMap.sourceMap.extend(this.sourceMap);
    }

    return copiedMap;
  }

  copy(
    keepSource: boolean,
    unbind: boolean,
    typeStorage?: ITypeStorage,
    document?: IDocument,
    scope?: IScope,
    astRef?: ASTBase
  ): Type {
    const copiedMap = new MapType(
      this.id,
      this.keyType.copy(keepSource, true, typeStorage, document, scope, astRef),
      this.valueType.copy(
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
      unbind ? new Map(this.properties) : this.properties,
      astRef,
      this.isScope
    );

    if (keepSource) {
      copiedMap.sourceMap.extend(this.sourceMap);
    }

    return copiedMap;
  }

  merge(source: IType): IType {
    if (!isMapType(source)) {
      return;
    }

    for (const [key, value] of this.properties) {
      this.properties.set(key, new EntityInfo(value.name, value.type));
    }

    this.sourceMap.extend(source.sourceMap);
  }

  toMeta(depth: number = 1): SignaturePayloadDefinitionType[] {
    if (depth > MAX_TO_META_DEPTH) {
      return [
        {
          type: SignatureDefinitionBaseType.Map,
          keyType: SignatureDefinitionBaseType.Any,
          valueType: SignatureDefinitionBaseType.Any
        }
      ];
    }

    const keyTypeMeta = simplifyForMeta(this.keyType).flatMap((it) =>
      it.toMeta(depth + 1)
    );
    const valueTypeMeta = simplifyForMeta(this.valueType).flatMap((it) =>
      it.toMeta(depth + 1)
    );

    if (keyTypeMeta.length + valueTypeMeta.length > 5) {
      return [
        {
          type: SignatureDefinitionBaseType.Map,
          keyType: SignatureDefinitionBaseType.Any,
          valueType: SignatureDefinitionBaseType.Any
        }
      ];
    }

    return keyTypeMeta.flatMap((keyType) => {
      return valueTypeMeta.flatMap((valueType) => {
        return {
          type: SignatureDefinitionBaseType.Map,
          keyType,
          valueType
        };
      });
    });
  }
}
