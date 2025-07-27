export enum CompletionItemKind {
  Variable = 'var',
  Property = 'property',
  Function = 'function',
  Literal = 'literal',
  Constant = 'constant',
  Internal = 'internal',
  InternalFunction = 'internal-function',
  InternalProperty = 'internal-property',
  ListConstructor = 'list',
  MapConstructor = 'map',
  Expression = 'expr',
  Unknown = 'unknown'
}

export interface CompletionItem {
  kind: CompletionItemKind;
  line: number;
}
