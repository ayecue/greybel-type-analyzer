import {
  ASTBase,
  ASTChunk,
  ASTIdentifier,
  ASTIndexExpression,
  ASTMemberExpression,
  ASTStringLiteral,
  ASTType
} from 'miniscript-core';

import {
  IChunkHelper,
  VariableSetterContextComponentKind,
  VariableSetterContextIndexResult,
  VariableSetterContextPropertyResult,
  VariableSetterContextVariableResult
} from '../types/ast';

export class ChunkHelper implements IChunkHelper {
  private _root: ASTChunk;

  constructor(root: ASTChunk) {
    this._root = root;
  }

  getLastASTItemOfLine(line: number): ASTBase {
    const items = this._root.lines[line];

    if (!items || items.length === 0) return null;

    let lastItem = items[0];

    for (let i = 1; i < items.length; i++) {
      const current = items[i];

      if (
        current.start.line > lastItem.start.line ||
        (current.start.line === lastItem.start.line &&
          current.start.character > lastItem.start.character)
      ) {
        lastItem = current;
      }
    }

    return lastItem;
  }

  findASTItemInLine(line: number, type: ASTType): ASTBase {
    const items = this._root.lines[line];

    if (items && items.length > 0) {
      const result = items.find((item) => item.type === type);

      if (result) {
        return result;
      }
    }

    return null;
  }

  findAssignmentVariableSetterContext(
    item: ASTBase
  ):
    | VariableSetterContextVariableResult
    | VariableSetterContextPropertyResult
    | VariableSetterContextIndexResult
    | null {
    switch (item.type) {
      case ASTType.MemberExpression: {
        const memberExpr = item as ASTMemberExpression;
        return {
          resolvePath: memberExpr.base,
          lastProperty: (memberExpr.identifier as ASTIdentifier).name,
          kind: VariableSetterContextComponentKind.Property
        };
      }
      case ASTType.Identifier: {
        return {
          property: (item as ASTIdentifier).name,
          kind: VariableSetterContextComponentKind.Variable
        };
      }
      case ASTType.IndexExpression: {
        const indexExpr = item as ASTIndexExpression;

        if (indexExpr.index.type === ASTType.StringLiteral) {
          return {
            resolvePath: indexExpr.base,
            lastProperty: (indexExpr.index as ASTStringLiteral).value,
            kind: VariableSetterContextComponentKind.Property
          };
        }

        return {
          resolvePath: indexExpr.base,
          lastComponent: indexExpr.index,
          kind: VariableSetterContextComponentKind.Type
        };
      }
    }

    return null;
  }
}
