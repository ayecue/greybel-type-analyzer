import type { ASTBase } from 'miniscript-core';

import type { IDocument } from './document';
import type {
  IEntityInfo,
  IFunctionType,
  IKeyType,
  IMapType,
  IType,
  PropertyInfo,
  SymbolInfo
} from './type';

export enum ScopeState {
  Inititialized,
  Pending,
  Resolved
}

export interface IScopeMetadata {
  readonly scope: IScope;
  readonly astRef: ASTBase;

  state: ScopeState;
}

export interface IScope {
  readonly outer?: IScope;
  readonly locals: IMapType;
  readonly document: IDocument;

  globals: IScope;
  associatedFunction?: IFunctionType;

  readonly symbols: SymbolInfo[];

  getSelf(): IType | undefined;
  getSuper(): IType | undefined;
  getOuter(): IMapType | undefined;
  getLocals(): IMapType;
  getGlobals(): IMapType;

  getProperty(name: string | IKeyType): IEntityInfo | undefined;
  setProperty(name: string | IKeyType, type: IType): void;
  hasProperty(key: string | IKeyType): boolean;
  getAllProperties(depth?: number): PropertyInfo[];

  resolveAllAvailableWithQuery(query: string): SymbolInfo[];
}
