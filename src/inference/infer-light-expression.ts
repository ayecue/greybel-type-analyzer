import {
  ASTFeatureEnvarExpression,
  ASTFeatureFileExpression,
  ASTFeatureInjectExpression,
  ASTType as GreybelASTType
} from 'greybel-core';
import { SignatureDefinitionBaseType } from 'meta-utils';
import {
  ASTBase,
  ASTBinaryExpression,
  ASTBooleanLiteral,
  ASTCallExpression,
  ASTComparisonGroupExpression,
  ASTFunctionStatement,
  ASTIdentifier,
  ASTIndexExpression,
  ASTIsaExpression,
  ASTListConstructorExpression,
  ASTLogicalExpression,
  ASTMapConstructorExpression,
  ASTMemberExpression,
  ASTNilLiteral,
  ASTNumericLiteral,
  ASTParenthesisExpression,
  ASTSliceExpression,
  ASTStringLiteral,
  ASTType,
  ASTUnaryExpression
} from 'miniscript-core';

import { EntityInfo } from '../entities/entity-info';
import { KeyType } from '../entities/key-type';
import { Type } from '../entities/type';
import { UnionType } from '../entities/union-type';
import { UnknownType } from '../entities/unknown-type';
import { CompletionItemKind } from '../types/completion';
import {
  ConstantIdentifier,
  ConstantIdentifierSet,
  PathType
} from '../types/inference';
import {
  isFunctionType,
  isListType,
  isMapType,
  isUnionType,
  IType,
  TypeKind
} from '../types/type';
import { InferBase } from './infer-base';

export class InferLightExpression extends InferBase {
  protected inferCallExpression(item: ASTCallExpression): IType {
    this.checkSkipNextInvoke(); // exhaust skip state
    const origin = this.infer(item.base);

    if (origin == null) {
      return Type.createBaseType(
        SignatureDefinitionBaseType.Any,
        this.context.typeStorage,
        this.context.document,
        this.context.scope,
        null
      );
    }

    return this.invoke(origin);
  }

  protected inferBinaryExpression(item: ASTBinaryExpression): IType {
    const left =
      new InferLightExpression(this.context).infer(item.left) ||
      Type.createBaseType(
        SignatureDefinitionBaseType.Any,
        this.context.typeStorage,
        this.context.document,
        this.context.scope,
        null
      );
    const right =
      new InferLightExpression(this.context).infer(item.right) ||
      Type.createBaseType(
        SignatureDefinitionBaseType.Any,
        this.context.typeStorage,
        this.context.document,
        this.context.scope,
        null
      );

    const leftKey = left.getKeyType();
    const rightKey = right.getKeyType();

    if (leftKey?.id === rightKey?.id) {
      if (isMapType(left)) {
        return Type.createBaseType(
          SignatureDefinitionBaseType.Map,
          this.context.typeStorage,
          this.context.document,
          this.context.scope,
          null
        );
      } else if (isListType(left)) {
        return Type.createBaseType(
          SignatureDefinitionBaseType.List,
          this.context.typeStorage,
          this.context.document,
          this.context.scope,
          null
        );
      } else if (isUnionType(left)) {
        return new UnionType(
          this.context.typeStorage.generateId(TypeKind.UnionType, item),
          [left, right],
          this.context.typeStorage,
          this.context.document,
          this.context.scope,
          null
        );
      }

      return Type.createBaseType(
        left.id,
        this.context.typeStorage,
        this.context.document,
        this.context.scope,
        null
      );
    }

    if (
      left.id === SignatureDefinitionBaseType.String ||
      right.id === SignatureDefinitionBaseType.String
    ) {
      // If one of the types is a string, we return a string type
      return Type.createBaseType(
        SignatureDefinitionBaseType.String,
        this.context.typeStorage,
        this.context.document,
        this.context.scope,
        null
      );
    } else if (
      left.id === SignatureDefinitionBaseType.Number ||
      right.id === SignatureDefinitionBaseType.Number
    ) {
      // If one of the types is a number, we return a number type
      return Type.createBaseType(
        SignatureDefinitionBaseType.Number,
        this.context.typeStorage,
        this.context.document,
        this.context.scope,
        null
      );
    }

    return Type.createBaseType(
      SignatureDefinitionBaseType.Any,
      this.context.typeStorage,
      this.context.document,
      this.context.scope,
      null
    );
  }

  protected inferIndexExpression(item: ASTIndexExpression): IType {
    this.checkSkipNextInvoke();
    const origin = this.infer(item.base);

    if (origin == null) {
      return Type.createBaseType(
        SignatureDefinitionBaseType.Any,
        this.context.typeStorage,
        this.context.document,
        this.context.scope,
        null
      );
    }

    if (item.index.type === ASTType.InvalidCodeExpression) {
      return Type.createBaseType(
        SignatureDefinitionBaseType.Any,
        this.context.typeStorage,
        this.context.document,
        this.context.scope
      );
    }

    // treat index as property access
    if (item.index.type === ASTType.StringLiteral) {
      const fieldKey = item.index as ASTStringLiteral;
      const property = fieldKey.value;
      const member = origin.getProperty(property);

      this.path += `.${property}`;
      this.value = null;

      // if there is a variable exit early
      if (member != null) {
        this.completionItemKind = isFunctionType(member.type)
          ? CompletionItemKind.Function
          : CompletionItemKind.Property;

        return member.type;
      }

      this.completionItemKind = CompletionItemKind.Property;

      const assumedType = new UnknownType(
        this.context.typeStorage,
        this.context.document,
        this.context.scope
      );

      origin.setProperty(property, new EntityInfo(property, assumedType));

      return assumedType;
    }

    const index =
      new InferLightExpression(this.context).infer(item.index) ||
      Type.createBaseType(
        SignatureDefinitionBaseType.Any,
        this.context.typeStorage,
        this.context.document,
        this.context.scope,
        null
      );

    // If the index is a union type, we need to handle each variant
    if (isUnionType(index)) {
      const variants = index.variants
        .map((variant) => origin.getProperty(variant.getKeyType())?.type)
        .filter((type) => type != null);

      this.completionItemKind = CompletionItemKind.Property;

      if (variants.length === 0) {
        return Type.createBaseType(
          SignatureDefinitionBaseType.Any,
          this.context.typeStorage,
          this.context.document,
          this.context.scope,
          null
        );
      } else if (variants.length === 1) {
        return index.firstVariant();
      }

      return new UnionType(
        this.context.typeStorage.generateId(TypeKind.UnionType, item),
        variants,
        this.context.typeStorage,
        this.context.document,
        this.context.scope,
        null
      );
    }

    const indexKeyType =
      index.getKeyType() ||
      new KeyType(
        SignatureDefinitionBaseType.Any,
        this.context.typeStorage,
        this.context.document,
        this.context.scope
      );
    const variable = origin.getProperty(indexKeyType);

    this.path += `[${index.id}]`;
    this.value = null;

    // if there is a variable exit early
    if (variable != null) {
      this.completionItemKind = isFunctionType(variable.type)
        ? CompletionItemKind.Function
        : CompletionItemKind.Property;

      return variable.type;
    }

    this.completionItemKind = CompletionItemKind.Property;

    const assumedType = new UnknownType(
      this.context.typeStorage,
      this.context.document,
      this.context.scope
    );

    origin.setProperty(
      indexKeyType,
      new EntityInfo(indexKeyType.id, assumedType)
    );

    return assumedType;
  }

  protected inferFunctionStatement(_item: ASTFunctionStatement): IType {
    const type = Type.createBaseType(
      SignatureDefinitionBaseType.Function,
      this.context.typeStorage,
      this.context.document,
      this.context.scope,
      null
    );

    this.path += PathType.Function;
    this.completionItemKind = CompletionItemKind.Function;
    this.value = null;

    return type;
  }

  protected inferIdentifier(item: ASTIdentifier): IType {
    const isSkip = this.checkSkipNextInvoke();

    this.path += item.name;
    this.value = null;

    if (
      ConstantIdentifierSet.has(item.name as ConstantIdentifier) &&
      !this.context.scope.hasProperty(item.name)
    ) {
      return (
        this.inferConstantIdentifier(item) ||
        Type.createBaseType(
          SignatureDefinitionBaseType.Any,
          this.context.typeStorage,
          this.context.document,
          this.context.scope,
          null
        )
      );
    }

    const property = item.name;
    const variable = this.context.scope.getProperty(property);

    // if there is a variable exit early
    if (variable != null) {
      this.completionItemKind = isFunctionType(variable.type)
        ? CompletionItemKind.Function
        : CompletionItemKind.Variable;

      return isSkip ? variable.type : this.invoke(variable.type);
    }

    this.completionItemKind = CompletionItemKind.Variable;

    const assumedType = new UnknownType(
      this.context.typeStorage,
      this.context.document,
      this.context.scope
    );

    this.context.scope.setProperty(property, assumedType);

    return assumedType;
  }

  protected inferMemberExpression(item: ASTMemberExpression): IType {
    const isSkip = this.checkSkipNextInvoke();
    const origin = this.infer(item.base);

    if (origin == null) {
      return Type.createBaseType(
        SignatureDefinitionBaseType.Any,
        this.context.typeStorage,
        this.context.document,
        this.context.scope,
        null
      );
    }

    if (item.identifier.type === ASTType.InvalidCodeExpression) {
      return Type.createBaseType(
        SignatureDefinitionBaseType.Any,
        this.context.typeStorage,
        this.context.document,
        this.context.scope
      );
    }

    const property = (item.identifier as ASTIdentifier).name;
    const member = origin.getProperty(property);

    this.path += `.${property}`;
    this.value = null;

    // if there is a member exit early
    if (member != null) {
      this.completionItemKind = isFunctionType(member.type)
        ? CompletionItemKind.Function
        : CompletionItemKind.Property;

      return isSkip ? member.type : this.invoke(member.type);
    }

    this.completionItemKind = CompletionItemKind.Property;

    const assumedType = new UnknownType(
      this.context.typeStorage,
      this.context.document,
      this.context.scope
    );

    origin.setProperty(property, new EntityInfo(property, assumedType));

    // allocate member if it does not exist
    return assumedType;
  }

  protected inferMapConstructorExpression(
    _item: ASTMapConstructorExpression
  ): IType {
    const type = Type.createBaseType(
      SignatureDefinitionBaseType.Map,
      this.context.typeStorage,
      this.context.document,
      this.context.scope,
      null
    );

    this.path += PathType.Map;
    this.completionItemKind = CompletionItemKind.MapConstructor;
    this.value = null;

    return type;
  }

  protected inferListConstructorExpression(
    _item: ASTListConstructorExpression
  ): IType {
    const type = Type.createBaseType(
      SignatureDefinitionBaseType.List,
      this.context.typeStorage,
      this.context.document,
      this.context.scope,
      null
    );

    this.path += PathType.List;
    this.completionItemKind = CompletionItemKind.ListConstructor;
    this.value = null;

    return type;
  }

  infer(item: ASTBase): IType {
    if (item == null) {
      return null;
    }

    switch (item.type) {
      case ASTType.ParenthesisExpression:
        return this.inferParenthesisExpression(
          item as ASTParenthesisExpression
        );
      case ASTType.CallExpression:
        return this.inferCallExpression(item as ASTCallExpression);
      case ASTType.BinaryExpression:
        return this.inferBinaryExpression(item as ASTBinaryExpression);
      case ASTType.LogicalExpression:
        return this.inferLogicalExpression(item as ASTLogicalExpression);
      case ASTType.IsaExpression:
        return this.inferIsaExpression(item as ASTIsaExpression);
      case ASTType.ComparisonGroupExpression:
        return this.inferComparisonGroupExpression(
          item as ASTComparisonGroupExpression
        );
      case ASTType.FunctionDeclaration:
        return this.inferFunctionStatement(item as ASTFunctionStatement);
      case ASTType.SliceExpression:
        return this.inferSliceExpression(item as ASTSliceExpression);
      case ASTType.IndexExpression:
        return this.inferIndexExpression(item as ASTIndexExpression);
      case ASTType.MemberExpression:
        return this.inferMemberExpression(item as ASTMemberExpression);
      case ASTType.Identifier:
        return this.inferIdentifier(item as ASTIdentifier);
      case ASTType.MapConstructorExpression:
        return this.inferMapConstructorExpression(
          item as ASTMapConstructorExpression
        );
      case ASTType.ListConstructorExpression:
        return this.inferListConstructorExpression(
          item as ASTListConstructorExpression
        );
      case ASTType.NegationExpression:
      case ASTType.BinaryNegatedExpression:
      case ASTType.UnaryExpression:
        return this.inferUnaryExpression(item as ASTUnaryExpression);
      case ASTType.NilLiteral:
        return this.inferNilLiteral(item as ASTNilLiteral);
      case ASTType.StringLiteral:
        return this.inferStringLiteral(item as ASTStringLiteral);
      case ASTType.NumericLiteral:
        return this.inferNumericLiteral(item as ASTNumericLiteral);
      case ASTType.BooleanLiteral:
        return this.inferBooleanLiteral(item as ASTBooleanLiteral);
      case GreybelASTType.FeatureFileExpression:
        return this.inferFeatureFileExpression(
          item as ASTFeatureFileExpression
        );
      case GreybelASTType.FeatureLineExpression:
        return this.inferFeatureLineExpression(item);
      case GreybelASTType.FeatureEnvarExpression:
        return this.inferFeatureEnvarExpression(
          item as ASTFeatureEnvarExpression
        );
      case GreybelASTType.FeatureInjectExpression:
        return this.inferFeatureInjectExpression(
          item as ASTFeatureInjectExpression
        );
      default:
        return null;
    }
  }
}
