import {
  SignatureDefinition,
  SignatureDefinitionBaseType,
  SignatureDefinitionFunction,
  SignaturePayloadDefinitionType
} from 'meta-utils';
import { ASTBase } from 'miniscript-core';

import { CompletionItemKind } from '../types/completion';
import { IDocument } from '../types/document';
import { IScope } from '../types/scope';
import { ITypeStorage } from '../types/storage';
import {
  IEntityInfo,
  IKeyType,
  ISA_PROPERTY,
  isBaseType,
  isFunctionType,
  isListType,
  isMapType,
  isUnionType,
  isUnknownType,
  IType,
  IUnknownType,
  KeyValue,
  MAX_ALL_PROPERTIES_DEPTH,
  PropertyInfo,
  TypeKind,
  UNKNOWN_TYPE_ID
} from '../types/type';
import { MAX_DEPTH } from '../types/type-manager';
import { FunctionType } from './function-type';
import { ListType } from './list-type';
import { MapType } from './map-type';
import { Type } from './type';
import { UnionType } from './union-type';

export class UnknownType extends Type implements IUnknownType {
  properties?: Map<string, IEntityInfo<IType>>;
  keyType?: IType;
  valueType?: IType;
  signature?: SignatureDefinition;

  get assumedId(): string {
    const kind = this.getKind();

    switch (kind) {
      case TypeKind.ListType:
        return SignatureDefinitionBaseType.List;
      case TypeKind.MapType:
        return SignatureDefinitionBaseType.Map;
      case TypeKind.FunctionType:
        return SignatureDefinitionBaseType.Function;
      default:
        return SignatureDefinitionBaseType.Any;
    }
  }

  constructor(
    typeStorage: ITypeStorage,
    document?: IDocument,
    scope?: IScope,
    astRef?: ASTBase
  ) {
    super(
      SignatureDefinitionBaseType.Any,
      TypeKind.UnknownType,
      SignatureDefinitionBaseType.Any,
      typeStorage,
      document,
      scope,
      astRef
    );
    this.properties = null;
    this.keyType = null;
    this.valueType = null;
    this.signature = null;
  }

  getKind(): TypeKind {
    if (
      this.keyType != null &&
      isBaseType(this.keyType) &&
      this.keyType.id === SignatureDefinitionBaseType.Number &&
      this.valueType != null
    ) {
      return TypeKind.ListType;
    } else if (this.properties != null && this.properties.size > 0) {
      return TypeKind.MapType;
    } else if (this.keyType != null && this.valueType != null) {
      return TypeKind.MapType;
    } else if (this.signature != null) {
      return TypeKind.FunctionType;
    }
    return TypeKind.Base;
  }

  getKeyType(): IKeyType | null {
    return this.typeStorage.getKeyTypeById(this.assumedId);
  }

  assumeType(
    typeStorage?: ITypeStorage,
    document?: IDocument,
    scope?: IScope
  ): IType {
    const kind = this.getKind();
    const currentTypeStorage = typeStorage || this.typeStorage;
    const currentDocument = document || this.document;
    const currentScope = scope || this.scope;

    switch (kind) {
      case TypeKind.ListType: {
        return new ListType(
          this.typeStorage.generateId(TypeKind.ListType),
          this.valueType,
          currentTypeStorage,
          currentDocument,
          currentScope
        );
      }
      case TypeKind.MapType: {
        return new MapType(
          this.typeStorage.generateId(TypeKind.MapType),
          this.keyType,
          this.valueType,
          currentTypeStorage,
          currentDocument,
          currentScope,
          this.properties
        );
      }
      case TypeKind.FunctionType: {
        return new FunctionType(
          this.typeStorage.generateId(TypeKind.FunctionType),
          this.signature as SignatureDefinitionFunction,
          currentTypeStorage,
          currentDocument,
          currentScope
        );
      }
      default: {
        return Type.createBaseType(
          this.assumedId,
          currentTypeStorage,
          currentDocument,
          currentScope
        );
      }
    }
  }

  addKeyVariant(keyType: IType): void {
    if (keyType == null) return;

    const incomingKeyType = Type.simplify(keyType);

    if (this.keyType == null) {
      this.keyType = incomingKeyType;
      return;
    }
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

    if (this.valueType == null) {
      this.valueType = incomingValueType;
      return;
    }
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

  setProperty(key: KeyValue, info: IEntityInfo): void {
    const incomingKeyType =
      typeof key === 'string'
        ? Type.createBaseType(
            SignatureDefinitionBaseType.String,
            this.typeStorage,
            this.document,
            this.scope
          )
        : key;

    this.addKeyVariant(incomingKeyType);
    this.addValueVariant(info.type);

    if (typeof key !== 'string') {
      return;
    }

    if (this.properties == null) {
      this.properties = new Map();
    }

    const existingInfo = this.properties.get(key);

    if (existingInfo) {
      if (isUnionType(existingInfo.type)) {
        existingInfo.type.addVariant(info.type);
      } else if (!info.type.equalsTo(existingInfo.type)) {
        existingInfo.type = new UnionType(
          this.typeStorage.generateId(TypeKind.UnionType),
          [existingInfo.type, info.type],
          this.typeStorage,
          this.document,
          this.scope
        );
      }

      return;
    }

    this.properties.set(key, info);
  }

  getProperty(key: KeyValue, depth: number = 1): IEntityInfo | undefined {
    if (this.properties == null) return super.getProperty(key, depth);
    if (depth > MAX_DEPTH) return;
    if (typeof key !== 'string') return;
    const propertyType = this.properties.get(key);
    if (propertyType) return propertyType;
    const isaEntity = this.properties.get(ISA_PROPERTY);
    if (isaEntity != null) {
      const isaProperty = isaEntity.type.getProperty(key, depth + 1);
      if (isaProperty) return isaProperty;
    }
    const inerhitType = this.typeStorage.getTypeById(this.assumedId);
    return inerhitType?.getProperty(key, depth + 1);
  }

  containsOwnProperties(): boolean {
    return true;
  }

  getAllProperties(depth: number = 1): PropertyInfo[] {
    if (depth > MAX_ALL_PROPERTIES_DEPTH) return [];
    const properties: Map<string, PropertyInfo> = new Map();
    const type = this.typeStorage.getTypeById(this.assumedId);

    if (type != null) {
      const typeProperties = type.getAllProperties(depth + 1);

      for (let index = 0; index < typeProperties.length; index++) {
        const property = typeProperties[index];
        if (!properties.has(property.name)) {
          properties.set(property.name, property);
        }
      }
    }

    if (this.properties != null) {
      for (const [key, info] of this.properties) {
        if (properties.has(key)) continue;
        properties.set(key, {
          type: info.type,
          name: info.name,
          kind: isFunctionType(info.type)
            ? CompletionItemKind.Function
            : CompletionItemKind.Property
        });
      }

      const isaEntity = this.properties.get(ISA_PROPERTY);
      if (isaEntity != null) {
        for (const property of isaEntity.type.getAllProperties(depth + 1)) {
          if (properties.has(property.name)) continue;
          properties.set(property.name, property);
        }
      }
    }

    return [...Array.from(properties.values())];
  }

  mergeIntoType(target: IType): void {
    target.addToSource(this);

    if (isUnknownType(target)) {
      target.merge(this);
    } else if (isMapType(target)) {
      if (this.keyType != null) {
        if (isUnionType(this.keyType)) {
          for (const variant of this.keyType.variants) {
            const keyType = variant.getKeyType();
            if (keyType == null) continue;
            target.addKeyVariant(keyType);
          }
        } else {
          const keyType = this.keyType.getKeyType();
          if (keyType != null) target.addKeyVariant(keyType);
        }
      }
      if (this.valueType != null) {
        target.addValueVariant(this.valueType);
      }
      if (this.properties != null) {
        for (const [key, value] of this.properties) {
          target.setProperty(key, value);
        }
      }
    } else if (isListType(target)) {
      if (this.valueType != null) target.addElementType(this.valueType);
    } else if (isUnionType(target)) {
      for (const variant of target.variants) {
        this.mergeIntoType(variant);
      }
    }
  }

  merge(source: IType): void {
    if (isUnknownType(source)) {
      if (source.keyType != null) this.addKeyVariant(source.keyType);
      if (source.valueType != null) this.addValueVariant(source.valueType);
      if (source.properties != null) {
        if (this.properties == null) {
          this.properties = new Map<string, IEntityInfo<IType>>();
        }

        for (const [key, value] of source.properties) {
          this.properties.set(key, value);
        }
      }
      if (source.signature != null) {
        this.signature = source.signature;
      }
    } else if (isMapType(source)) {
      this.addKeyVariant(source.keyType);
      this.addValueVariant(source.valueType);

      if (this.properties == null) {
        this.properties = new Map<string, IEntityInfo<IType>>();
      }

      for (const [key, value] of source.properties) {
        if (typeof key !== 'string') continue;
        this.properties.set(key, value);
      }
    } else if (isListType(source)) {
      this.addValueVariant(source.elementType);
    } else if (isUnionType(source)) {
      for (const variant of source.variants) {
        this.merge(variant);
      }
    } else if (isFunctionType(source)) {
      this.signature = source.signature;
    }
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

    const copiedAny = new UnknownType(
      typeStorage || this.typeStorage,
      document || this.document,
      scope || this.scope,
      astRef
    );

    refs.set(this, copiedAny);

    copiedAny.signature = this.signature;
    copiedAny.keyType = this.keyType?.copy(
      keepSource,
      true,
      typeStorage,
      document,
      scope,
      astRef
    );
    copiedAny.valueType = this.valueType?.copy(
      keepSource,
      true,
      typeStorage,
      document,
      scope,
      astRef
    );

    if (this.properties != null) {
      copiedAny.properties = new Map<string, IEntityInfo<IType>>();
      for (const [key, value] of this.properties) {
        copiedAny.properties.set(key, {
          name: value.name,
          type: value.type.deepCopy(
            keepSource,
            typeStorage,
            document,
            scope,
            null,
            refs
          )
        });
      }
    }

    if (keepSource) {
      copiedAny.sourceMap.extend(this.sourceMap);
    }

    return copiedAny;
  }

  copy(
    keepSource: boolean,
    unbind: boolean = false,
    typeStorage?: ITypeStorage,
    document?: IDocument,
    scope?: IScope,
    astRef?: ASTBase
  ): Type {
    const copiedAny = new UnknownType(
      typeStorage || this.typeStorage,
      document || this.document,
      scope || this.scope,
      astRef
    );

    copiedAny.signature = this.signature;
    copiedAny.keyType = this.keyType?.copy(
      keepSource,
      true,
      typeStorage,
      document,
      scope
    );
    copiedAny.valueType = this.valueType?.copy(
      keepSource,
      true,
      typeStorage,
      document,
      scope
    );
    copiedAny.properties =
      this.properties != null
        ? unbind
          ? new Map(this.properties)
          : this.properties
        : null;

    if (keepSource) {
      copiedAny.sourceMap.extend(this.sourceMap);
    }

    return copiedAny;
  }

  toMeta(): SignaturePayloadDefinitionType[] {
    return [
      {
        type: this.assumedId
      }
    ];
  }
}
