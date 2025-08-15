import {
  SignatureDefinition,
  SignatureDefinitionBaseType,
  SignatureDefinitionFunction,
  SignaturePayloadDefinitionFunction
} from 'meta-utils';
import { ASTChunk, ASTComment, ASTType } from 'miniscript-core';

import { ClassType } from '../entities/class-type';
import { KeyType } from '../entities/key-type';
import { IDocument } from '../types/document';
import { IScope } from '../types/scope';
import { ITypeStorage } from '../types/storage';
import {
  parseVirtualType,
  VIRTUAL_TYPE_MAIN_TAG,
  VIRTUAL_TYPE_MAIN_TAG_REGEX,
  VirtualType
} from '../utils/parse-virtual-type';
import { ScopeCommentIterator } from '../utils/scope-comment-iterator';

export interface RegistryItem {
  classRef: ClassType;
  virtualTypeDef: VirtualType;
}

export class ASTSignatureAggregator {
  private typeStorage: ITypeStorage;
  private document: IDocument;
  private scope: IScope;

  private iterator: ScopeCommentIterator;
  private registry: Map<string, RegistryItem>;

  constructor(
    typeStorage: ITypeStorage,
    document: IDocument,
    scope: IScope,
    chunk: ASTChunk
  ) {
    this.typeStorage = typeStorage;
    this.document = document;
    this.scope = scope;
    this.iterator = new ScopeCommentIterator(chunk, chunk);
    this.registry = new Map<string, RegistryItem>();
  }

  private aggregateNextPayload(comment: ASTComment): string {
    let payload: string = comment.value;
    let item = this.iterator.next();

    while (!item.done) {
      const currentItem = item.value;

      if (currentItem?.type !== ASTType.Comment) {
        break;
      }

      payload += '\n' + (currentItem as ASTComment).value;
      item = this.iterator.next();
    }

    this.iterator.rollback();

    return payload;
  }

  private aggregateVirtualTypeFromComment(comment: ASTComment): void {
    const line = comment.value.trimLeft();

    if (!line.startsWith(VIRTUAL_TYPE_MAIN_TAG)) {
      return;
    }

    const result = line.match(VIRTUAL_TYPE_MAIN_TAG_REGEX);

    if (!result || result.length < 2) {
      return;
    }

    const typeName = result[1];

    if (this.registry.has(typeName)) {
      return;
    }

    const payload = this.aggregateNextPayload(comment);
    const virtualTypeDef = parseVirtualType(payload);
    const classRef = new ClassType(
      typeName,
      null,
      virtualTypeDef.extends,
      this.typeStorage,
      this.document,
      this.scope
    );

    this.registry.set(typeName, {
      classRef,
      virtualTypeDef
    });

    this.typeStorage.addType(classRef);
    this.typeStorage.addKeyType(
      new KeyType(typeName, this.typeStorage, this.document, this.scope, true)
    );
  }

  aggregate(): void {
    let item = this.iterator.next();

    while (!item.done) {
      const currentItem = item.value;

      if (currentItem?.type === ASTType.Comment) {
        this.aggregateVirtualTypeFromComment(currentItem as ASTComment);
      }

      item = this.iterator.next();
    }
  }

  evaluate(): void {
    this.registry.forEach((item) => {
      const classRef = item.classRef;
      const virtualTypeDef = item.virtualTypeDef;

      Object.entries(virtualTypeDef.definitions).forEach(
        ([key, definition]) => {
          const def =
            definition.type === SignatureDefinitionBaseType.Function
              ? SignatureDefinitionFunction.parse(
                  this.document.name,
                  definition as SignaturePayloadDefinitionFunction
                )
              : SignatureDefinition.parse(this.document.name, definition);

          classRef.insertDefinition(key, def);
        }
      );
    });
  }
}
