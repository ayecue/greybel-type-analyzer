import {
  ASTFeatureEnvarExpression,
  ASTFeatureFileExpression,
  ASTFeatureInjectExpression
} from 'greybel-core';
import { SignatureDefinitionBaseType } from 'meta-utils';
import {
  ASTBase,
  ASTBaseBlockWithScope,
  ASTBooleanLiteral,
  ASTComment,
  ASTComparisonGroupExpression,
  ASTIdentifier,
  ASTIsaExpression,
  ASTLogicalExpression,
  ASTNilLiteral,
  ASTNumericLiteral,
  ASTParenthesisExpression,
  ASTSliceExpression,
  ASTStringLiteral,
  ASTType,
  ASTUnaryExpression,
  Operator
} from 'miniscript-core';

import { EntityInfo } from '../entities/entity-info';
import { MapType } from '../entities/map-type';
import { Type } from '../entities/type';
import { UnionType } from '../entities/union-type';
import { CompletionItemKind } from '../types/completion';
import {
  ConstantIdentifier,
  DEFAULT_CUSTOM_FUNCTION_DESCRIPTION,
  PathType,
  UnaryType
} from '../types/inference';
import {
  ISA_PROPERTY,
  isFunctionType,
  isMapType,
  IType,
  MAX_STRING_LENGTH,
  NIL_TYPE_ID,
  TypeKind
} from '../types/type';
import { assumeCompletionItemKind } from '../utils/assume-completion-item-kind';
import { determineTypeFromMeta } from '../utils/determine-type-from-meta';
import { normalizeText } from '../utils/normalize-text';
import { parseAssignDescription } from '../utils/parse-assign-description';
import { InferContext } from './infer-context';

export abstract class InferBase {
  protected context: InferContext;

  // runtime state
  protected skipNextInvoke: boolean;
  protected completionItemKind: CompletionItemKind;
  protected path: string;
  protected value: string;

  constructor(context: InferContext, invoke: boolean = true) {
    this.context = context;
    this.skipNextInvoke = !invoke;
    this.path = '';
    this.value = null;
  }

  getCompletionItemKind(): CompletionItemKind {
    return this.completionItemKind;
  }

  getPath(): string {
    return this.path;
  }

  getValue(): string | null {
    return this.value;
  }

  protected invoke(item: IType): IType {
    let returnType: IType | null = null;

    if (isFunctionType(item)) {
      // If the function scope is not yet aggregated, we need to do it now
      const scopeMetadata = this.context.document.scopeFnMapping.get(item);

      if (scopeMetadata != null) {
        this.context.onRequestScope?.(
          scopeMetadata.astRef as ASTBaseBlockWithScope
        );
      }

      returnType = item.invoke(
        this.context.typeStorage,
        this.context.document,
        this.context.scope
      );
    } else {
      returnType = item.invoke(
        this.context.typeStorage,
        this.context.document,
        this.context.scope
      );
    }

    this.completionItemKind = assumeCompletionItemKind(returnType, this.path);
    this.value = null;

    return returnType;
  }

  protected checkSkipNextInvoke(): boolean {
    if (this.skipNextInvoke) {
      this.skipNextInvoke = false;
      return true;
    }
    return false;
  }

  protected resolveRelatedCommentLines(item: ASTBase): string[] | null {
    const chunkHelper = this.context.document.chunkHelper;
    const previousItem = chunkHelper.getLastASTItemOfLine(item.start.line - 1);
    const currentItem = chunkHelper.findASTItemInLine(
      item.start.line,
      ASTType.Comment
    );

    if (previousItem?.type === ASTType.Comment) {
      const visited: Set<ASTBase> = new Set();
      const lines: string[] = [];
      let index = item.start.line - 1;

      while (index >= 0) {
        const item = chunkHelper.getLastASTItemOfLine(index--);

        if (visited.has(item)) continue;

        if (item?.type === ASTType.Comment) {
          visited.add(item);
          lines.unshift(normalizeText((item as ASTComment).value));
        } else {
          break;
        }
      }

      return lines;
    } else if (currentItem?.type === ASTType.Comment) {
      return [normalizeText((currentItem as ASTComment).value)];
    }

    return null;
  }

  inferCommentDefinition(item: ASTBase): IType | null {
    const commentLines = this.resolveRelatedCommentLines(item);

    if (commentLines != null) {
      const comment = commentLines.join('\n');
      const result = parseAssignDescription(comment);

      if (result != null) {
        return result.type.length > 1
          ? new UnionType(
              this.context.typeStorage.generateId(TypeKind.UnionType, item),
              result.type.map((type) => {
                return determineTypeFromMeta(
                  type,
                  this.context.typeStorage,
                  this.context.document,
                  this.context.scope
                );
              }),
              this.context.typeStorage,
              this.context.document,
              this.context.scope,
              item
            )
          : determineTypeFromMeta(
              result.type[0],
              this.context.typeStorage,
              this.context.document,
              this.context.scope,
              item
            );
      }
    }

    return null;
  }

  protected createFunctionDescription(
    item: ASTBase,
    defaultText: string = DEFAULT_CUSTOM_FUNCTION_DESCRIPTION
  ): string | null {
    const description = this.resolveRelatedCommentLines(item);

    if (description == null) {
      return defaultText;
    }

    return description.join('\n\n');
  }

  protected inferLogicalExpression(_item: ASTLogicalExpression): IType {
    const type = Type.createBaseType(
      SignatureDefinitionBaseType.Number,
      this.context.typeStorage,
      this.context.document,
      this.context.scope,
      null
    );

    this.path += PathType.Number;
    this.completionItemKind = CompletionItemKind.Expression;
    this.value = null;

    return type;
  }

  protected inferIsaExpression(_item: ASTIsaExpression): IType {
    const type = Type.createBaseType(
      SignatureDefinitionBaseType.Number,
      this.context.typeStorage,
      this.context.document,
      this.context.scope,
      null
    );

    this.path += PathType.Number;
    this.completionItemKind = CompletionItemKind.Expression;
    this.value = null;

    return type;
  }

  protected inferComparisonGroupExpression(
    _item: ASTComparisonGroupExpression
  ): IType {
    const type = Type.createBaseType(
      SignatureDefinitionBaseType.Number,
      this.context.typeStorage,
      this.context.document,
      this.context.scope,
      null
    );

    this.path += PathType.Number;
    this.completionItemKind = CompletionItemKind.Expression;
    this.value = null;

    return type;
  }

  protected inferSliceExpression(item: ASTSliceExpression): IType {
    const result = this.infer(item.base);

    this.path += PathType.Slice;
    this.completionItemKind = CompletionItemKind.Expression;
    this.value = null;

    return result;
  }

  protected inferConstantIdentifier(item: ASTIdentifier): IType {
    const scope = this.context.scope;

    this.completionItemKind = CompletionItemKind.Constant;

    switch (item.name) {
      case ConstantIdentifier.Self:
        return scope.getSelf();
      case ConstantIdentifier.Globals:
        return scope.getGlobals();
      case ConstantIdentifier.Outer:
        return scope.getOuter();
      case ConstantIdentifier.Locals:
        return scope.getLocals();
      case ConstantIdentifier.Super:
        return scope.getSuper();
      default:
        throw new Error(`Unknown constant identifier: ${item.name}`);
    }
  }

  /**
   * Operator.New
   * Operator.Reference
   * Operator.Not
   * Operator.Minus
   */
  protected inferUnaryExpression(item: ASTUnaryExpression): IType {
    // Exit out early
    if (item.operator === UnaryType.Not) {
      const type = Type.createBaseType(
        SignatureDefinitionBaseType.Number,
        this.context.typeStorage,
        this.context.document,
        this.context.scope,
        null
      );

      return type;
    }

    if (item.operator === Operator.Reference) {
      this.skipNextInvoke = true;
    }

    const argValue = this.infer(item.argument);

    if (argValue == null) {
      return Type.createBaseType(
        SignatureDefinitionBaseType.Any,
        this.context.typeStorage,
        this.context.document,
        this.context.scope,
        null
      );
    }

    if (item.operator === Operator.New && isMapType(argValue)) {
      const type = new MapType(
        this.context.typeStorage.generateId(TypeKind.MapType, item),
        null,
        null,
        this.context.typeStorage,
        this.context.document,
        this.context.scope,
        null
      );

      type.setProperty(ISA_PROPERTY, new EntityInfo(ISA_PROPERTY, argValue));

      return type;
    }

    return argValue;
  }

  protected inferNilLiteral(_item: ASTNilLiteral): IType {
    const type = Type.createBaseType(
      NIL_TYPE_ID,
      this.context.typeStorage,
      this.context.document,
      this.context.scope,
      null
    );

    this.path += PathType.Nil;
    this.completionItemKind = CompletionItemKind.Literal;
    this.value = 'null';

    return type;
  }

  protected inferStringLiteral(item: ASTStringLiteral): IType {
    const type = Type.createBaseType(
      SignatureDefinitionBaseType.String,
      this.context.typeStorage,
      this.context.document,
      this.context.scope,
      null
    );
    const value =
      item.value.length > MAX_STRING_LENGTH
        ? `"${item.value.slice(0, MAX_STRING_LENGTH)}..."`
        : `"${item.value}"`;

    this.path += value;
    this.completionItemKind = CompletionItemKind.Literal;
    this.value = value;

    return type;
  }

  protected inferNumericLiteral(item: ASTNumericLiteral): IType {
    const type = Type.createBaseType(
      SignatureDefinitionBaseType.Number,
      this.context.typeStorage,
      this.context.document,
      this.context.scope,
      null
    );

    this.path += item.value.toString();
    this.completionItemKind = CompletionItemKind.Literal;
    this.value = item.value.toString();

    return type;
  }

  protected inferBooleanLiteral(item: ASTBooleanLiteral): IType {
    const type = Type.createBaseType(
      SignatureDefinitionBaseType.Number,
      this.context.typeStorage,
      this.context.document,
      this.context.scope,
      null
    );

    this.path += PathType.Number;
    this.completionItemKind = CompletionItemKind.Literal;
    this.value = item.value.toString();

    return type;
  }

  protected inferFeatureFileExpression(_item: ASTFeatureFileExpression): IType {
    const type = Type.createBaseType(
      SignatureDefinitionBaseType.String,
      this.context.typeStorage,
      this.context.document,
      this.context.scope,
      null
    );

    this.path += PathType.String;
    this.completionItemKind = CompletionItemKind.Literal;
    this.value = null;

    return type;
  }

  protected inferFeatureLineExpression(_item: ASTBase): IType {
    const type = Type.createBaseType(
      SignatureDefinitionBaseType.Number,
      this.context.typeStorage,
      this.context.document,
      this.context.scope,
      null
    );

    this.path += PathType.Number;
    this.completionItemKind = CompletionItemKind.Literal;
    this.value = null;

    return type;
  }

  protected inferFeatureEnvarExpression(
    _item: ASTFeatureEnvarExpression
  ): IType {
    const type = Type.createBaseType(
      SignatureDefinitionBaseType.String,
      this.context.typeStorage,
      this.context.document,
      this.context.scope,
      null
    );

    this.path += PathType.String;
    this.completionItemKind = CompletionItemKind.Literal;
    this.value = null;

    return type;
  }

  protected inferFeatureInjectExpression(
    _item: ASTFeatureInjectExpression
  ): IType {
    const type = Type.createBaseType(
      SignatureDefinitionBaseType.String,
      this.context.typeStorage,
      this.context.document,
      this.context.scope,
      null
    );

    this.path += PathType.String;
    this.completionItemKind = CompletionItemKind.Literal;
    this.value = null;

    return type;
  }

  protected inferParenthesisExpression(item: ASTParenthesisExpression): IType {
    return this.infer(item.expression);
  }

  abstract infer(item: ASTBase): IType;
}
