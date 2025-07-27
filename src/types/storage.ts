import type { SignatureDefinitionType } from 'meta-utils';
import { ASTBase } from 'miniscript-core';

import type {
  IClassType,
  IEntityInfo,
  IKeyType,
  IType,
  KeyValue,
  TypeKind
} from './type';

export interface ITypeStorage {
  readonly parent?: ITypeStorage;
  readonly memory: Map<string, IType>;
  readonly typeInterfaces: Map<SignatureDefinitionType, IClassType>;
  readonly keyTypes: Map<SignatureDefinitionType, IKeyType>;

  __internalHandleCounter: number;

  addToAny(key: KeyValue, info: IEntityInfo): void;
  addKeyType(keyType: IKeyType): void;

  getKeyType(type: IType): IKeyType | null;
  addType(type: IClassType): void;
  getType(type: IType): IClassType | null;

  getInerhitType(type: IType): IClassType | null;
  getInerhitKeyType(type: IType): IKeyType | null;

  getKeyTypeById(id: SignatureDefinitionType): IKeyType | null;
  getTypeById(type: SignatureDefinitionType): IClassType | null;
  getTypePropertyById(
    type: SignatureDefinitionType,
    key: KeyValue
  ): IEntityInfo | null;

  merge(typeStorage: ITypeStorage): void;
  copy(): ITypeStorage;

  generateId(type: TypeKind, astRef?: ASTBase): string;
}
