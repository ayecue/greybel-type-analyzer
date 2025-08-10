import { SignatureDefinitionType } from 'meta-utils';
import { ASTBase } from 'miniscript-core';

import { ITypeStorage } from '../types/storage';
import {
  IClassType,
  IEntityInfo,
  IKeyType,
  IType,
  KeyValue,
  TypeKind
} from '../types/type';
import { deepMerge } from '../utils/merge-helper';

export class TypeStorage implements ITypeStorage {
  public readonly parent?: TypeStorage;
  public readonly memory: Map<string, IType> = new Map();
  public readonly typeInterfaces: Map<SignatureDefinitionType, IClassType>;
  public readonly keyTypes: Map<SignatureDefinitionType, IKeyType>;

  __internalHandleCounter: number;

  constructor(parent?: TypeStorage) {
    this.parent = parent;
    this.memory = new Map();
    this.typeInterfaces = new Map();
    this.keyTypes = new Map();
    this.__internalHandleCounter = 0;
  }

  addToAny(key: KeyValue, info: IEntityInfo): void {
    /* By default it should not add anything to any */
  }

  addType(type: IClassType): void {
    const existingType = this.typeInterfaces.get(type.id);
    if (existingType) {
      existingType.merge(type);
      return;
    }
    this.typeInterfaces.set(type.id, type);
  }

  getType(type: IType): IClassType | null {
    const relatedType = this.typeInterfaces.get(type.id);
    if (relatedType && relatedType !== type) return relatedType;
    return this.parent?.getType(type) || null;
  }

  getInerhitType(type: IType): IClassType | null {
    if (type.inheritFrom == null) return null;
    const relatedType = this.typeInterfaces.get(type.inheritFrom);
    if (relatedType && relatedType !== type) return relatedType;
    return this.parent?.getInerhitType(type) || null;
  }

  getTypeById(type: SignatureDefinitionType): IClassType | null {
    const relatedType = this.typeInterfaces.get(type);
    if (relatedType) return relatedType;
    return this.parent?.getTypeById(type) || null;
  }

  getTypePropertyById(
    type: SignatureDefinitionType,
    key: KeyValue
  ): IEntityInfo | null {
    const value = this.typeInterfaces.get(type)?.getProperty(key);
    if (value) return value;
    return this.parent?.getTypePropertyById(type, key) || null;
  }

  addKeyType(keyType: IKeyType): void {
    if (this.keyTypes.has(keyType.id)) {
      return;
    }
    this.keyTypes.set(keyType.id, keyType);
  }

  getKeyType(type: IType): IKeyType | null {
    return (
      this.keyTypes.get(type.id) ||
      this.parent?.getKeyType(type) ||
      this.getInerhitKeyType(type)
    );
  }

  getInerhitKeyType(type: IType): IKeyType | null {
    if (type.inheritFrom == null) return null;
    const relatedKeyType = this.keyTypes.get(type.inheritFrom);
    if (relatedKeyType) return relatedKeyType;
    return this.parent?.getInerhitKeyType(type) || null;
  }

  getKeyTypeById(id: SignatureDefinitionType): IKeyType | null {
    const keyType = this.keyTypes.get(id);
    if (keyType) return keyType;
    return this.parent?.getKeyTypeById(id) || null;
  }

  merge(typeStorage: TypeStorage): void {
    typeStorage.memory.forEach((type, id) => {
      const existingType = this.memory.get(id);
      if (existingType) {
        this.memory.set(id, deepMerge(typeStorage, existingType, type));
        return;
      }
      this.memory.set(id, type.deepCopy(true, this) as IType);
    });

    typeStorage.typeInterfaces.forEach((type, id) => {
      const existingType = this.typeInterfaces.get(id);
      if (existingType) {
        this.typeInterfaces.set(
          id,
          deepMerge(typeStorage, existingType, type) as IClassType
        );
        return;
      }
      this.typeInterfaces.set(id, type.deepCopy(true, this) as IClassType);
    });

    typeStorage.keyTypes.forEach((keyType, id) => {
      if (!this.keyTypes.has(id)) {
        this.keyTypes.set(id, keyType.copy(true, true, this) as IKeyType);
      }
    });
  }

  generateId(type: TypeKind, astRef?: ASTBase): string {
    const identifier = astRef
      ? `<${astRef.type}:${astRef.start.toString()}-${astRef.end.toString()}>`
      : '<virtual>';
    return `${type}-global-${this.__internalHandleCounter++}-${identifier}`;
  }

  copy(): TypeStorage {
    const newStorage = new TypeStorage(this.parent);
    this.typeInterfaces.forEach((type, id) => {
      newStorage.typeInterfaces.set(
        id,
        type.copy(true, true, newStorage) as IClassType
      );
    });
    this.keyTypes.forEach((keyType, id) => {
      newStorage.keyTypes.set(
        id,
        keyType.copy(true, true, newStorage) as IKeyType
      );
    });
    return newStorage;
  }
}
