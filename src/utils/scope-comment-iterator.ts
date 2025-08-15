import {
  ASTBase,
  ASTBaseBlockWithScope,
  ASTChunk,
  ASTComment,
  ASTType
} from 'miniscript-core';

export class ScopeCommentIterator implements Iterator<ASTBase> {
  private chunk: ASTChunk;
  private scope: ASTBaseBlockWithScope;
  private currentLine: number;
  private previousLine: number | null;
  private bodyItemPointer: number;

  constructor(chunk: ASTChunk, scope: ASTBaseBlockWithScope) {
    this.chunk = chunk;
    this.scope = scope;
    this.currentLine = scope.start.line;
    this.previousLine = null;
    this.bodyItemPointer = 0;
  }

  private skipNonCommentItems(): void {
    let currentBodyItem = this.scope.body[this.bodyItemPointer];

    while (currentBodyItem && currentBodyItem.start.line === this.currentLine) {
      this.bodyItemPointer++;
      this.currentLine = currentBodyItem.end.line + 1;
      currentBodyItem = this.scope.body[this.bodyItemPointer];
    }
  }

  next(): IteratorResult<ASTComment, ASTComment | null> {
    this.skipNonCommentItems();

    if (
      this.currentLine > this.chunk.end.line ||
      this.currentLine > this.scope.end.line
    ) {
      return {
        done: true,
        value: null
      };
    }

    const currentLineContext = this.chunk.lines[this.currentLine];

    if (
      currentLineContext == null ||
      currentLineContext.length !== 1 ||
      currentLineContext[0].type !== ASTType.Comment
    ) {
      this.previousLine = this.currentLine;
      this.currentLine++;

      return {
        done: false,
        value: null
      };
    }

    const currentLineItem = currentLineContext[0];

    this.previousLine = this.currentLine;
    this.currentLine +=
      currentLineItem.end.line - currentLineItem.start.line + 1;

    return {
      done: false,
      value: currentLineItem as ASTComment
    };
  }

  rollback() {
    if (this.previousLine === null) {
      return;
    }

    this.currentLine = this.previousLine;
    this.previousLine = null;
  }
}
