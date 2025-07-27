import { ASTBase } from 'miniscript-core';

import { IDocument } from '../types/document';
import { IScope } from '../types/scope';
import { ITypeStorage } from '../types/storage';
import { IKeyType, TypeKind } from '../types/type';
import { Type } from './type';

export class KeyType extends Type implements IKeyType {
  public readonly isUserDefined: boolean;

  constructor(
    name: string,
    typeStorage: ITypeStorage,
    document?: IDocument,
    scope?: IScope,
    isUserDefined: boolean = false,
    astRef?: ASTBase
  ) {
    super(name, TypeKind.KeyType, name, typeStorage, document, scope, astRef);
    this.isUserDefined = isUserDefined;
  }

  getKeyType(): IKeyType | null {
    return this;
  }

  copy(
    keepSource: boolean,
    _unbind: boolean,
    typeStorage?: ITypeStorage,
    document?: IDocument,
    scope?: IScope,
    astRef?: ASTBase
  ): Type {
    const copiedKeyType = new KeyType(
      this.id,
      typeStorage || this.typeStorage,
      document || this.document,
      scope || this.scope,
      this.isUserDefined,
      astRef
    );

    if (keepSource) {
      copiedKeyType.sourceMap.extend(this.sourceMap);
    }

    return copiedKeyType;
  }
}
