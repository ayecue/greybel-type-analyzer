import {
  SignatureDefinitionBaseType,
  SignatureDefinitionFunction,
  SignaturePayloadDefinitionType
} from 'meta-utils';
import { ASTBase } from 'miniscript-core';

import { IDocument } from '../types/document';
import { IScope } from '../types/scope';
import { ITypeStorage } from '../types/storage';
import { IFunctionType, isFunctionType, IType, TypeKind } from '../types/type';
import { determineTypeFromMeta } from '../utils/determine-type-from-meta';
import { Type } from './type';
import { UnionType } from './union-type';

export class FunctionType extends Type implements IFunctionType {
  public readonly signature: SignatureDefinitionFunction;
  public context?: IType;
  public returnType: IType | null;
  public isPersistent?: boolean;

  constructor(
    id: string,
    signature: SignatureDefinitionFunction,
    typeStorage: ITypeStorage,
    document?: IDocument,
    scope?: IScope,
    astRef?: ASTBase
  ) {
    super(
      id,
      TypeKind.FunctionType,
      SignatureDefinitionBaseType.Function,
      typeStorage,
      document,
      scope,
      astRef
    );
    this.signature = signature;
    this.returnType = null;
  }

  getReturnType(
    typeStorage?: ITypeStorage,
    document?: IDocument,
    scope?: IScope,
    astRef?: ASTBase
  ): IType {
    if (this.returnType == null) {
      const returnTypes = this.signature
        .getReturns()
        .map((item) =>
          determineTypeFromMeta(
            item,
            typeStorage || this.typeStorage,
            document || this.document,
            scope || this.scope
          )
        );

      if (returnTypes.length === 1) {
        return returnTypes[0];
      }

      return new UnionType(
        this.typeStorage.generateId(TypeKind.UnionType, astRef),
        returnTypes,
        typeStorage || this.typeStorage,
        document || this.document,
        scope || this.scope,
        null
      );
    }
    return this.returnType;
  }

  equalsTo(anotherType: Type): boolean {
    if (!isFunctionType(anotherType)) return false;
    return anotherType.signature.getId() === this.signature.getId();
  }

  invoke(
    typeStorage?: ITypeStorage,
    document?: IDocument,
    scope?: IScope,
    astRef?: ASTBase
  ): IType {
    const returnValue = this.getReturnType(
      typeStorage,
      document,
      scope,
      astRef
    );
    return this.isPersistent
      ? returnValue
      : returnValue.copy(false, true, typeStorage, document, scope);
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

    const copiedFunction = new FunctionType(
      this.id,
      this.signature,
      typeStorage || this.typeStorage,
      document || this.document,
      scope || this.scope,
      astRef
    );

    refs.set(this, copiedFunction);

    copiedFunction.returnType = this.returnType
      ? this.returnType.deepCopy(
          false,
          typeStorage,
          document,
          scope,
          null,
          refs
        )
      : null;

    if (keepSource) {
      copiedFunction.sourceMap.extend(this.sourceMap);
    }

    return copiedFunction;
  }

  copy(
    keepSource: boolean,
    _unbind: boolean,
    typeStorage?: ITypeStorage,
    document?: IDocument,
    scope?: IScope,
    astRef?: ASTBase
  ): Type {
    const copiedFunction = new FunctionType(
      this.id,
      this.signature,
      typeStorage || this.typeStorage,
      document || this.document,
      scope || this.scope,
      astRef
    );

    copiedFunction.returnType = this.returnType;

    if (keepSource) {
      copiedFunction.sourceMap.extend(this.sourceMap);
    }

    return copiedFunction;
  }

  toMeta(_depth?: number): SignaturePayloadDefinitionType[] {
    return [
      {
        type: SignatureDefinitionBaseType.Function
      }
    ];
  }
}
