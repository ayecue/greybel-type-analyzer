import { SignatureDefinitionBaseType } from 'meta-utils';
import { ASTBase } from 'miniscript-core';

import { EntityInfo } from '../entities/entity-info';
import { IDocument } from '../types/document';
import { IEntityInfo, KeyValue, TypeKind } from '../types/type';
import {
  createProxyForNativeType,
  persistTypeInNativeFunction
} from '../utils/native-type-helper';
import { TypeStorage } from './type-storage';

export class DocumentTypeStorage extends TypeStorage {
  protected readonly document: IDocument;

  constructor(document: IDocument, parent: TypeStorage) {
    super(parent);
    this.document = document;
  }

  insertDefault(): void {
    const globalTypeStorage = this.parent;

    if (!globalTypeStorage) {
      throw new Error('Global type storage is not defined.');
    }

    const proxyGeneral = createProxyForNativeType(
      SignatureDefinitionBaseType.General,
      this.document
    );
    const proxyFunction = createProxyForNativeType(
      SignatureDefinitionBaseType.Function,
      this.document
    );
    const proxyMap = createProxyForNativeType(
      SignatureDefinitionBaseType.Map,
      this.document
    );
    const proxyList = createProxyForNativeType(
      SignatureDefinitionBaseType.List,
      this.document
    );
    const proxyNumber = createProxyForNativeType(
      SignatureDefinitionBaseType.Number,
      this.document
    );
    const proxyString = createProxyForNativeType(
      SignatureDefinitionBaseType.String,
      this.document
    );
    const proxyAny = createProxyForNativeType(
      SignatureDefinitionBaseType.Any,
      this.document
    );
    const proxyFuncRefFn = persistTypeInNativeFunction(
      SignatureDefinitionBaseType.General,
      'funcRef',
      proxyFunction,
      this.document,
      globalTypeStorage
    );
    const proxyMapFn = persistTypeInNativeFunction(
      SignatureDefinitionBaseType.General,
      'map',
      proxyMap,
      this.document,
      globalTypeStorage
    );
    const proxyListFn = persistTypeInNativeFunction(
      SignatureDefinitionBaseType.General,
      'list',
      proxyList,
      this.document,
      globalTypeStorage
    );
    const proxyNumberFn = persistTypeInNativeFunction(
      SignatureDefinitionBaseType.General,
      'number',
      proxyNumber,
      this.document,
      globalTypeStorage
    );
    const proxyStringFn = persistTypeInNativeFunction(
      SignatureDefinitionBaseType.General,
      'string',
      proxyString,
      this.document,
      globalTypeStorage
    );

    proxyGeneral.setProperty(
      'funcRef',
      new EntityInfo('funcRef', proxyFuncRefFn)
    );
    proxyGeneral.setProperty('map', new EntityInfo('map', proxyMapFn));
    proxyGeneral.setProperty('list', new EntityInfo('list', proxyListFn));
    proxyGeneral.setProperty('number', new EntityInfo('number', proxyNumberFn));
    proxyGeneral.setProperty('string', new EntityInfo('string', proxyStringFn));

    this.addType(proxyGeneral);
    this.addType(proxyFunction);
    this.addType(proxyMap);
    this.addType(proxyList);
    this.addType(proxyNumber);
    this.addType(proxyString);
    this.addType(proxyAny);
  }

  addToAny(key: KeyValue, info: IEntityInfo): void {
    if (typeof key !== 'string') return;
    const anyType = this.typeInterfaces.get(SignatureDefinitionBaseType.Any);
    if (anyType != null) anyType.properties.set(key, info);
  }

  generateId(type: TypeKind, astRef?: ASTBase): string {
    const identifier = astRef
      ? `<${astRef.type}:${astRef.start.toString()}-${astRef.end.toString()}>`
      : '<virtual>';
    return `${type}-${this.document.name}-${this.__internalHandleCounter++}-${identifier}`;
  }
}
