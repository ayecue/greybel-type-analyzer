import type { IDocument } from './document';
import type { IScope } from './scope';

export const DEFAULT_CUSTOM_FUNCTION_DESCRIPTION =
  `This is a custom method. You can add a description for this method by adding a comment above or after the function.
\`\`\`
myFunction = function(a, b, c) // This function does xyz
\`\`\`
or
\`\`\`
/*
  This function does xyz
*/
myFunction = function(a, b, c)
\`\`\`` as const;

export enum ConstantIdentifier {
  Self = 'self',
  Globals = 'globals',
  Outer = 'outer',
  Locals = 'locals',
  Super = 'super'
}

export const ConstantIdentifierSet: Set<ConstantIdentifier> = new Set(
  Object.values(ConstantIdentifier)
);

export enum UnaryType {
  Not = 'not',
  Negate = 'negate',
  AddressOf = 'addressOf'
}

export enum PathType {
  Map = '$map',
  List = '$list',
  String = '$string',
  Number = '$number',
  Nil = '$null',
  Slice = '$slice',
  Function = '$function',
  Expression = '$expression'
}

export interface IInferContext {
  readonly document: IDocument;
  readonly scope: IScope;
}
