import { CompletionItemKind } from "../types/completion";
import { IType, TypeKind } from "../types/type";

export function assumeCompletionItemKind(result: IType, path?: string): CompletionItemKind {
  if (result == null) return CompletionItemKind.Variable;

  switch (result.kind) {
    case TypeKind.MapType:
      return CompletionItemKind.MapConstructor;
    case TypeKind.ListType:
      return CompletionItemKind.ListConstructor;
    case TypeKind.FunctionType:
      return CompletionItemKind.Function;
    case TypeKind.ClassType:
      return CompletionItemKind.Constant;
    default:
      return path?.includes('.') ? CompletionItemKind.Property : CompletionItemKind.Variable;
  }
}