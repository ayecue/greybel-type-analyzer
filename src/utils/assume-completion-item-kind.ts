import { SignatureDefinitionBaseType } from "meta-utils";
import { CompletionItemKind } from "../types/completion";
import { IType, NIL_TYPE_ID, TypeKind } from "../types/type";

const PATH_SEPARATOR = '.' as const;
const ARRAY_INDEX_SEPARATOR = '[' as const;

export function assumeCompletionItemKind(result: IType, path?: string): CompletionItemKind {
  const isMember = path?.includes(PATH_SEPARATOR) || path?.includes(ARRAY_INDEX_SEPARATOR);
  const varKind = isMember ? CompletionItemKind.Property : CompletionItemKind.Variable;

  if (result == null) return varKind;

  switch (result.kind) {
    case TypeKind.MapType:
      return CompletionItemKind.MapConstructor;
    case TypeKind.ListType:
      return CompletionItemKind.ListConstructor;
    case TypeKind.FunctionType:
      return CompletionItemKind.Function;
    case TypeKind.ClassType:
      return CompletionItemKind.Constant;
    case TypeKind.Base:
      switch (result.id) {
        case SignatureDefinitionBaseType.String:
        case SignatureDefinitionBaseType.Number:
        case NIL_TYPE_ID:
          return CompletionItemKind.Literal;
      }
    default:
      return varKind;
  }
}