import {
  Signature,
  SignatureDefinition,
  SignatureDefinitionBaseType,
  SignatureDefinitionFunction,
  SignatureDefinitionType,
  SignaturePayloadDefinitionType
} from 'meta-utils';
import { ASTBase } from 'miniscript-core';

import { CompletionItemKind } from '../types/completion';
import { IDocument } from '../types/document';
import { IScope } from '../types/scope';
import { ITypeStorage } from '../types/storage';
import {
  BASE_TYPE_SET,
  IClassType,
  IEntityInfo,
  IMapType,
  isClassType,
  isFunctionType,
  IType,
  KeyValue,
  MAX_ALL_PROPERTIES_DEPTH,
  PropertyInfo,
  TypeKind,
  UNKNOWN_TYPE_ID
} from '../types/type';
import { MAX_DEPTH } from '../types/type-manager';
import { EntityInfo } from './entity-info';
import { FunctionType } from './function-type';
import { ListType } from './list-type';
import { MapType } from './map-type';
import { Type } from './type';

export class ClassType extends Type implements IClassType {
  public readonly properties: Map<string, IEntityInfo>;
  public readonly associatedMap: IMapType | null;

  constructor(
    id: string,
    associatedMap: IMapType | null = null,
    inheritFrom: SignatureDefinitionType | null = null,
    typeStorage: ITypeStorage,
    document?: IDocument,
    scope?: IScope,
    properties?: Map<string, IEntityInfo>,
    astRef?: ASTBase
  ) {
    super(
      id,
      TypeKind.ClassType,
      inheritFrom,
      typeStorage,
      document,
      scope,
      astRef
    );
    this.associatedMap = associatedMap;
    this.properties = properties || new Map();
  }

  insertDefinition(property: string, definition: SignatureDefinition): void {
    if (this.hasProperty(property)) return;

    const definitionType = definition.getType();

    switch (definitionType.type) {
      case SignatureDefinitionBaseType.Function: {
        const elementType = new FunctionType(
          SignatureDefinitionBaseType.Function,
          definition as SignatureDefinitionFunction,
          this.typeStorage,
          this.document,
          this.scope
        );
        const entityInfo = new EntityInfo(property, elementType);
        this.setProperty(property, entityInfo);
        break;
      }
      case SignatureDefinitionBaseType.List: {
        const elementType = new ListType(
          this.typeStorage.generateId(TypeKind.ListType),
          Type.createBaseType(
            definitionType.valueType.type ?? UNKNOWN_TYPE_ID,
            this.typeStorage,
            this.document,
            this.scope
          ),
          this.typeStorage,
          this.document,
          this.scope
        );
        const entityInfo = new EntityInfo(property, elementType);
        this.setProperty(property, entityInfo);
        break;
      }
      case SignatureDefinitionBaseType.Map: {
        const elementType = new MapType(
          this.typeStorage.generateId(TypeKind.MapType),
          Type.createBaseType(
            definitionType.keyType.type ?? UNKNOWN_TYPE_ID,
            this.typeStorage,
            this.document,
            this.scope
          ),
          Type.createBaseType(
            definitionType.valueType.type ?? UNKNOWN_TYPE_ID,
            this.typeStorage,
            this.document,
            this.scope
          ),
          this.typeStorage,
          this.document,
          this.scope,
          null
        );
        const entityInfo = new EntityInfo(property, elementType);
        this.setProperty(property, entityInfo);
        break;
      }
      case SignatureDefinitionBaseType.Number:
      case SignatureDefinitionBaseType.String:
      case SignatureDefinitionBaseType.Any: {
        const elementType = Type.createBaseType(
          definitionType.type ?? SignatureDefinitionBaseType.Any,
          this.typeStorage,
          this.document,
          this.scope
        );
        const entityInfo = new EntityInfo(property, elementType);
        this.setProperty(property, entityInfo);
        break;
      }
      default: {
        const elementType = Type.createBaseType(
          definitionType.type ?? SignatureDefinitionBaseType.Any,
          this.typeStorage,
          this.document,
          this.scope
        );
        const entityInfo = new EntityInfo(property, elementType);
        this.setProperty(property, entityInfo);
        break;
      }
    }
  }

  insertSignature(signature: Signature): void {
    const properties = Object.keys(signature.getDefinitions());

    for (let index = 0; index < properties.length; index++) {
      const property = properties[index];
      const definition = signature.getDefinition(property);

      this.insertDefinition(property, definition);
    }
  }

  equalsTo(anotherType: IClassType): boolean {
    if (!isClassType(anotherType)) return false;
    return (
      this.referenceEqualsTo(anotherType) ||
      (this.id === anotherType.id && this.document === anotherType.document)
    );
  }

  getProperty(key: KeyValue, depth: number = 1): IEntityInfo | undefined {
    if (depth > MAX_DEPTH) return;
    if (typeof key !== 'string') return;
    if (this.associatedMap) {
      const mapProperty = this.associatedMap.getProperty(key, depth + 1);
      if (mapProperty) return mapProperty;
    }
    const ownProperty = this.properties.get(key);
    if (ownProperty) return ownProperty;
    if (this.inheritFrom == null) return;
    const inerhitType = this.typeStorage.getInerhitType(this);
    return inerhitType?.getProperty(key, depth + 1);
  }

  setProperty(key: KeyValue, info: IEntityInfo): void {
    if (typeof key !== 'string') return;
    this.properties.set(key, info);
    if (this.id !== SignatureDefinitionBaseType.General)
      this.typeStorage.addToAny(key, info);
  }

  hasProperty(key: KeyValue): boolean {
    if (typeof key !== 'string') return false;
    return this.properties.has(key);
  }

  containsOwnProperties(): boolean {
    return true;
  }

  getAllProperties(depth: number = 1): PropertyInfo[] {
    if (depth > MAX_ALL_PROPERTIES_DEPTH) return [];
    const properties: Map<string, PropertyInfo> = new Map();
    const isNativeType = BASE_TYPE_SET.has(
      this.id as SignatureDefinitionBaseType
    );

    for (const [key, info] of this.properties) {
      if (!properties.has(key)) {
        properties.set(key, {
          type: info.type,
          name: info.name,
          kind: isNativeType
            ? isFunctionType(info.type)
              ? CompletionItemKind.InternalFunction
              : CompletionItemKind.InternalProperty
            : isFunctionType(info.type)
              ? CompletionItemKind.Function
              : CompletionItemKind.Property
        });
      }
    }

    if (this.associatedMap) {
      for (const property of this.associatedMap.getAllProperties(depth + 1)) {
        if (!properties.has(property.name)) {
          properties.set(property.name, property);
        }
      }
    }

    if (this.inheritFrom) {
      const inerhitType = this.typeStorage.getInerhitType(this);
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

    const copiedClass = new ClassType(
      this.id,
      null,
      this.inheritFrom,
      typeStorage || this.typeStorage,
      document || this.document,
      scope || this.scope,
      new Map(),
      astRef
    );

    refs.set(this, copiedClass);

    // @ts-expect-error
    copiedClass.associatedMap = this.associatedMap
      ? (this.associatedMap.deepCopy(
          keepSource,
          typeStorage,
          document,
          scope,
          astRef,
          refs
        ) as IMapType)
      : null;

    for (const [key, info] of this.properties) {
      copiedClass.properties.set(
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
      copiedClass.sourceMap.extend(this.sourceMap);
    }

    return copiedClass;
  }

  copy(
    keepSource: boolean,
    unbind: boolean,
    typeStorage?: ITypeStorage,
    document?: IDocument,
    scope?: IScope,
    astRef?: ASTBase
  ): Type {
    const copiedClass = new ClassType(
      this.id,
      this.associatedMap,
      this.inheritFrom,
      typeStorage || this.typeStorage,
      document || this.document,
      scope || this.scope,
      unbind ? new Map(this.properties) : this.properties
    );

    if (keepSource) {
      copiedClass.sourceMap.extend(this.sourceMap);
    }

    return copiedClass;
  }

  merge(source: IType): void {
    if (!isClassType(source)) {
      return;
    }

    for (const [key, value] of source.properties) {
      this.properties.set(key, new EntityInfo(value.name, value.type));
    }

    this.sourceMap.extend(source.sourceMap);
  }

  toMeta(_depth?: number): SignaturePayloadDefinitionType[] {
    return [
      {
        type: this.id
      }
    ];
  }
}
