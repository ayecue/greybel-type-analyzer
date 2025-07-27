import { ASTBase, ASTPosition } from 'miniscript-core';

import { IDocument } from '../types/document';
import {
  DEFAULT_SOURCE_DOCUMENT_ID,
  ISourceMap,
  TypeSource
} from '../types/type';

export class SourceMap implements ISourceMap {
  private readonly map: Map<string, ASTBase>;

  static createTypeSourceMapKey(
    document: IDocument | undefined,
    start: ASTPosition,
    end: ASTPosition
  ): string {
    return `${document?.name || DEFAULT_SOURCE_DOCUMENT_ID}||${start.line}:${start.character}||${end.line}:${end.character}`;
  }

  static parseTypeSourceMapKey(item: string): Omit<TypeSource, 'astRef'> {
    const segments = item.split('||');
    if (segments.length !== 3) {
      throw new Error(`Invalid type source map key format: ${item}`);
    }
    const [document, start, end] = segments;
    const [startLine, startCharacter] = start.split(':');
    const [endLine, endCharacter] = end.split(':');
    return {
      document,
      start: {
        line: Number(startLine),
        character: Number(startCharacter)
      },
      end: {
        line: Number(endLine),
        character: Number(endCharacter)
      }
    };
  }

  constructor() {
    this.map = new Map();
  }

  get size(): number {
    return this.map.size;
  }

  add(document: IDocument | undefined, astRef: ASTBase): this {
    const key = SourceMap.createTypeSourceMapKey(
      document,
      astRef.start,
      astRef.end
    );
    this.map.set(key, astRef);
    return this;
  }

  extend(other: SourceMap): this {
    for (const [key, value] of other.map.entries()) {
      this.map.set(key, value);
    }
    return this;
  }

  clear(): this {
    this.map.clear();
    return this;
  }

  getAllSources(): TypeSource[] {
    return Array.from(this.map.entries()).reduce((result, [key, value]) => {
      result.push({
        ...SourceMap.parseTypeSourceMapKey(key),
        astRef: value
      });
      return result;
    }, []);
  }
}
