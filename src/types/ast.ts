import type { ASTBase, ASTType } from 'miniscript-core';

export enum VariableSetterContextComponentKind {
  Variable = 'variable',
  Property = 'property',
  Type = 'type'
}

interface VariableSetterContextBaseResult {
  kind: VariableSetterContextComponentKind;
}

export interface VariableSetterContextVariableResult
  extends VariableSetterContextBaseResult {
  property: string;
  kind: VariableSetterContextComponentKind.Variable;
}

export interface VariableSetterContextPropertyResult
  extends VariableSetterContextBaseResult {
  resolvePath: ASTBase | null;
  lastProperty: string;
  kind: VariableSetterContextComponentKind.Property;
}

export interface VariableSetterContextIndexResult
  extends VariableSetterContextBaseResult {
  resolvePath: ASTBase | null;
  lastComponent: ASTBase;
  kind: VariableSetterContextComponentKind.Type;
}

export interface IChunkHelper {
  getLastASTItemOfLine(line: number): ASTBase;
  findASTItemInLine(line: number, type: ASTType): ASTBase | null;
  findAssignmentVariableSetterContext(
    item: ASTBase
  ):
    | VariableSetterContextVariableResult
    | VariableSetterContextPropertyResult
    | VariableSetterContextIndexResult
    | null;
}

export function isVariableSetterContextVariable(
  context: VariableSetterContextBaseResult
): context is VariableSetterContextVariableResult {
  return context.kind === VariableSetterContextComponentKind.Variable;
}

export function isVariableSetterContextProperty(
  context: VariableSetterContextBaseResult
): context is VariableSetterContextPropertyResult {
  return context.kind === VariableSetterContextComponentKind.Property;
}

export function isVariableSetterContextIndex(
  context: VariableSetterContextBaseResult
): context is VariableSetterContextIndexResult {
  return context.kind === VariableSetterContextComponentKind.Type;
}
