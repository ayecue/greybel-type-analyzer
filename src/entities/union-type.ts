import {
  SignatureDefinitionBaseType,
  SignaturePayloadDefinitionType
} from 'meta-utils';
import { ASTBase } from 'miniscript-core';

import { IDocument } from '../types/document';
import { IScope } from '../types/scope';
import { ITypeStorage } from '../types/storage';
import {
  IEntityInfo,
  isUnionType,
  IType,
  IUnionType,
  KeyValue,
  MAX_TO_META_DEPTH,
  PropertyInfo,
  TypeKind,
  TypeSource
} from '../types/type';
import { simplifyForMeta } from '../utils/native-type-helper';
import { SourceMap } from '../utils/source-map';
import { EntityInfo } from './entity-info';
import { Type } from './type';

export class UnionType extends Type implements IUnionType {
  public readonly variants: Type[];

  static createDefault(
    typeStorage: ITypeStorage,
    document?: IDocument,
    scope?: IScope,
    astRef?: ASTBase
  ): UnionType {
    return new UnionType(
      typeStorage.generateId(TypeKind.UnionType, astRef),
      [],
      typeStorage,
      document,
      scope,
      astRef
    );
  }

  constructor(
    id: string,
    variants: Type[],
    typeStorage: ITypeStorage,
    document?: IDocument,
    scope?: IScope,
    astRef?: ASTBase
  ) {
    super(id, TypeKind.UnionType, id, typeStorage, document, scope, astRef);
    this.variants = variants;
    this.uniquifyVariants();
  }

  private uniquifyVariants(): void {
    const variants: Type[] = [];
    const queue = [...this.variants];

    while (queue.length > 0) {
      const variant = queue.pop();
      if (isUnionType(variant)) {
        this.addToSource(variant);
        queue.push(...variant.variants);
        continue;
      }
      const existingVariantIdx = variants.findIndex((v) => v.equalsTo(variant));
      if (existingVariantIdx !== -1) {
        const existingVariant = variants[existingVariantIdx];
        existingVariant.merge(variant);
        continue;
      }
      variants.push(variant);
    }

    this.variants.length = 0;
    this.variants.push(...variants);
  }

  containsVariant(type: Type): boolean {
    return this.variants.some((t) => t.equalsTo(type));
  }

  addVariant(type: Type): void {
    if (isUnionType(type)) {
      this.addToSource(type);
      type.variants.forEach((variant) => this.addVariant(variant));
      return;
    }
    const existingVariantIdx = this.variants.findIndex((v) => v.equalsTo(type));
    if (existingVariantIdx !== -1) {
      const existingVariant = this.variants[existingVariantIdx];
      existingVariant.merge(type);
      return;
    }
    this.variants.push(type);
  }

  setProperty(key: KeyValue, info: IEntityInfo): void {
    this.variants.forEach((variant) => variant.setProperty(key, info));
  }

  getProperty(key: KeyValue, depth: number = 1): IEntityInfo | undefined {
    const properties: IEntityInfo[] = [];

    for (let index = 0; index < this.variants.length; index++) {
      const variant = this.variants[index];
      const property = variant.getProperty(key, depth + 1);

      if (property) {
        properties.push(property);
      }
    }

    if (properties.length === 0) {
      return;
    } else if (properties.length === 1) {
      return properties[0];
    }

    return new EntityInfo(
      properties[0].name,
      new UnionType(
        this.typeStorage.generateId(TypeKind.UnionType),
        properties.map((info) => info.type),
        this.typeStorage,
        this.document,
        this.scope,
        null
      )
    );
  }

  getAllProperties(depth: number = 1): PropertyInfo[] {
    const properties: Map<string, PropertyInfo> = new Map();

    for (let index = 0; index < this.variants.length; index++) {
      const variant = this.variants[index];
      const allProperties = variant.getAllProperties(depth + 1);
      for (let j = 0; j < allProperties.length; j++) {
        const property = allProperties[j];
        if (!properties.has(property.name)) {
          properties.set(property.name, property);
        }
      }
    }

    return Array.from(properties.values());
  }

  hasProperty(key: KeyValue): boolean {
    return this.variants.some((variant) => {
      return variant.hasProperty(key);
    });
  }

  containsOwnProperties(): boolean {
    return this.variants.some((variant) => variant.containsOwnProperties());
  }

  invoke(
    typeStorage?: ITypeStorage,
    document?: IDocument,
    scope?: IScope,
    astRef?: ASTBase
  ): IType {
    return new UnionType(
      this.typeStorage.generateId(TypeKind.UnionType, astRef),
      this.variants.map((variant) =>
        variant.invoke(
          typeStorage || this.typeStorage,
          document || this.document,
          scope || this.scope,
          astRef
        )
      ),
      typeStorage || this.typeStorage,
      document || this.document,
      scope || this.scope,
      astRef
    );
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

    const copiedUnion = new UnionType(
      this.id,
      [],
      typeStorage || this.typeStorage,
      document || this.document,
      scope || this.scope,
      astRef
    );

    refs.set(this, copiedUnion);

    this.variants.forEach((variant) => {
      const copiedVariant = variant.deepCopy(
        keepSource,
        typeStorage,
        document,
        scope,
        null,
        refs
      );
      copiedUnion.variants.push(copiedVariant);
    });

    if (keepSource) {
      copiedUnion.sourceMap.extend(this.sourceMap);
    }

    return copiedUnion;
  }

  copy(
    keepSource: boolean,
    unbind: boolean,
    typeStorage?: ITypeStorage,
    document?: IDocument,
    scope?: IScope,
    astRef?: ASTBase
  ): Type {
    const copiedUnion = new UnionType(
      this.id,
      // union need to copied since otherwise references remain the same
      this.variants.map((variant) =>
        variant.copy(
          keepSource,
          unbind,
          typeStorage || this.typeStorage,
          document || this.document,
          scope || this.scope
        )
      ),
      typeStorage || this.typeStorage,
      document || this.document,
      scope || this.scope,
      astRef
    );

    if (keepSource) {
      copiedUnion.sourceMap.extend(this.sourceMap);
    }

    return copiedUnion;
  }

  getSource(): TypeSource[] | null {
    const tempSourceMap = new SourceMap();
    tempSourceMap.extend(this.sourceMap as SourceMap);
    this.variants.forEach((variant) =>
      tempSourceMap.extend(variant.sourceMap as SourceMap)
    );
    if (tempSourceMap.size === 0) return null;
    return tempSourceMap.getAllSources();
  }

  toMeta(depth: number = 1): SignaturePayloadDefinitionType[] {
    if (depth > MAX_TO_META_DEPTH) {
      return [
        {
          type: SignatureDefinitionBaseType.Any
        }
      ];
    }

    return simplifyForMeta(this).flatMap((variant) => {
      return variant.toMeta(depth + 1);
    });
  }
}
