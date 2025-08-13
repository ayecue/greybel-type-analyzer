import {
  ASTFeatureEnvarExpression,
  ASTFeatureFileExpression,
  ASTFeatureInjectExpression,
  ASTType as GreybelASTType
} from 'greybel-core';
import {
  SignatureDefinitionBaseType,
  SignatureDefinitionFunction
} from 'meta-utils';
import {
  ASTAssignmentStatement,
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
  ASTUnaryExpression,
  Operator
} from 'miniscript-core';

import { ClassType } from '../entities/class-type';
import { EntityInfo } from '../entities/entity-info';
import { FunctionType } from '../entities/function-type';
import { KeyType } from '../entities/key-type';
import { ListType } from '../entities/list-type';
import { MapType } from '../entities/map-type';
import { Type } from '../entities/type';
import { UnionType } from '../entities/union-type';
import { UnknownType } from '../entities/unknown-type';
import { CompletionItemKind } from '../types/completion';
import {
  ConstantIdentifier,
  ConstantIdentifierSet,
  PathType,
  SIMPLE_BINARY_OPERATORS_SET,
  UnaryType
} from '../types/inference';
import {
  DEFAULT_SIGNATURE_ORIGIN,
  IMapType,
  ISA_PROPERTY,
  isFunctionType,
  isListType,
  isMapType,
  isUnionType,
  IType,
  TypeKind,
  UNKNOWN_TYPE_ID
} from '../types/type';
import { determineTypeFromMeta } from '../utils/determine-type-from-meta';
import { enrichWithMetaInformation } from '../utils/enrich-with-meta-information';
import { shallowMergeList, shallowMergeMap } from '../utils/merge-helper';
import { parseMapDescription } from '../utils/parse-map-description';
import { InferBase } from './infer-base';
import { InferLightExpression } from './infer-light-expression';

export class InferFullExpression extends InferBase {
  createCustomTypeFromMap(item: ASTBase, map: IMapType): void {
    const commentLines = this.resolveRelatedCommentLines(item);

    if (commentLines == null) {
      return;
    }

    const comment = commentLines.join('\n');
    const result = parseMapDescription(comment);

    if (result == null) {
      return;
    }

    result.properties.forEach((property) => {
      if (property.path === ISA_PROPERTY) {
        return;
      }

      const path = property.path.split('.');
      const propType =
        property.type.length > 1
          ? new UnionType(
              this.context.typeStorage.generateId(TypeKind.UnionType, item),
              property.type.map((type) => {
                return determineTypeFromMeta(
                  type,
                  this.context.typeStorage,
                  this.context.document,
                  this.context.scope
                );
              }),
              this.context.typeStorage,
              this.context.document,
              this.context.scope
            )
          : determineTypeFromMeta(
              property.type[0],
              this.context.typeStorage,
              this.context.document,
              this.context.scope
            );

      map.setPropertyInPath(
        path,
        new EntityInfo(path[path.length - 1], propType)
      );
    });

    this.context.typeStorage.addType(
      new ClassType(
        result.type,
        map,
        result.extends || SignatureDefinitionBaseType.Map,
        this.context.typeStorage,
        this.context.document,
        this.context.scope,
        new Map()
      )
    );
    this.context.typeStorage.addKeyType(
      new KeyType(
        result.type,
        this.context.typeStorage,
        this.context.document,
        this.context.scope,
        true
      )
    );
  }

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
    if (SIMPLE_BINARY_OPERATORS_SET.has(item.operator)) {
      this.path += PathType.Expression;
      this.completionItemKind = CompletionItemKind.Expression;
      this.value = null;

      return Type.createBaseType(
        SignatureDefinitionBaseType.Number,
        this.context.typeStorage,
        this.context.document,
        this.context.scope,
        null
      );
    }

    const left =
      new InferFullExpression(this.context).infer(item.left) ||
      Type.createBaseType(
        SignatureDefinitionBaseType.Any,
        this.context.typeStorage,
        this.context.document,
        this.context.scope,
        null
      );
    const right =
      new InferFullExpression(this.context).infer(item.right) ||
      Type.createBaseType(
        SignatureDefinitionBaseType.Any,
        this.context.typeStorage,
        this.context.document,
        this.context.scope,
        null
      );

    this.path += PathType.Expression;
    this.completionItemKind = CompletionItemKind.Expression;
    this.value = null;

    switch (item.operator) {
      case Operator.Plus:
        return this.handleBinaryAddOperation(left, right);
      case Operator.Asterik:
        return this.handleBinaryMultiplyOperation(left, right);
      default:
        return this.handleDefaultMathOperation(left, right);
    }
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

    this.path += `[${index.id}]`;
    this.value = null;

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
    const member = origin.getProperty(indexKeyType);

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

    origin.setProperty(
      indexKeyType,
      new EntityInfo(indexKeyType.id, assumedType)
    );

    return assumedType;
  }

  protected inferFunctionStatement(item: ASTFunctionStatement): IType {
    const description = this.createFunctionDescription(item);
    const signature = SignatureDefinitionFunction.parse(
      DEFAULT_SIGNATURE_ORIGIN,
      {
        id: this.context.typeStorage.generateId(TypeKind.FunctionType, item),
        type: SignatureDefinitionBaseType.Function,
        description,
        arguments: item.parameters.map((arg: ASTBase) => {
          if (arg.type === ASTType.Identifier) {
            return {
              label: (arg as ASTIdentifier).name ?? 'unknown',
              type: SignatureDefinitionBaseType.Any
            };
          }

          const assignment = arg as ASTAssignmentStatement;
          const rightValue =
            new InferFullExpression(this.context).infer(assignment.init) ||
            Type.createBaseType(
              SignatureDefinitionBaseType.Any,
              this.context.typeStorage,
              this.context.document,
              this.context.scope,
              null
            );

          return {
            label: (assignment.variable as ASTIdentifier)?.name ?? 'unknown',
            types: [
              rightValue.getKeyType()?.id || SignatureDefinitionBaseType.Any
            ]
          };
        }),
        returns: [UNKNOWN_TYPE_ID]
      }
    ) as SignatureDefinitionFunction;
    const type = new FunctionType(
      SignatureDefinitionBaseType.Function,
      enrichWithMetaInformation(this.context.typeStorage, signature),
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
    item: ASTMapConstructorExpression
  ): IType {
    this.path += PathType.Map;
    this.completionItemKind = CompletionItemKind.MapConstructor;
    this.value = '{}';

    if (item.fields.length === 0) {
      const newMap = new MapType(
        this.context.typeStorage.generateId(TypeKind.MapType, item),
        null,
        null,
        this.context.typeStorage,
        this.context.document,
        this.context.scope,
        null
      );

      return newMap;
    }

    const newMap = new MapType(
      this.context.typeStorage.generateId(TypeKind.MapType, item),
      null,
      null,
      this.context.typeStorage,
      this.context.document,
      this.context.scope,
      null
    );

    for (let index = 0; index < item.fields.length; index++) {
      const field = item.fields[index];
      const value = new InferFullExpression(this.context)
        .infer(field.value)
        ?.copy(
          false,
          true,
          this.context.typeStorage,
          this.context.document,
          this.context.scope,
          field.value
        );

      if (value == null) {
        continue; // skip if value is not inferable
      }

      if (field.key.type === ASTType.StringLiteral) {
        const fieldKey = field.key as ASTStringLiteral;
        newMap.setProperty(
          fieldKey.value,
          new EntityInfo(fieldKey.value, value)
        );
      } else {
        const fieldKey = new InferLightExpression(this.context).infer(
          field.key
        );

        if (fieldKey == null) {
          continue; // skip if key is not inferable
        }

        // If the key is a union type, we need to handle each variant
        if (isUnionType(fieldKey)) {
          fieldKey.variants.forEach((variant) => {
            const keyType = variant.getKeyType();

            if (keyType == null) {
              return; // skip if key type is not inferable
            }

            newMap.setProperty(keyType, new EntityInfo(keyType.id, value));
          });
        } else {
          const keyType = fieldKey.getKeyType();

          if (keyType == null) {
            continue; // skip if key type is not inferable
          }

          newMap.setProperty(keyType, new EntityInfo(keyType.id, value));
        }
      }
    }

    return newMap;
  }

  protected inferListConstructorExpression(
    item: ASTListConstructorExpression
  ): IType {
    this.path += PathType.List;
    this.completionItemKind = CompletionItemKind.ListConstructor;
    this.value = '[]';

    if (item.fields.length === 0) {
      return new ListType(
        this.context.typeStorage.generateId(TypeKind.ListType, item),
        Type.createBaseType(
          SignatureDefinitionBaseType.Any,
          this.context.typeStorage,
          this.context.document,
          this.context.scope
        ),
        this.context.typeStorage,
        this.context.document,
        this.context.scope
      );
    }

    const newList = new ListType(
      this.context.typeStorage.generateId(TypeKind.ListType, item),
      null,
      this.context.typeStorage,
      this.context.document,
      this.context.scope
    );

    for (let index = 0; index < item.fields.length; index++) {
      const field = item.fields[index];
      const value = new InferFullExpression(this.context)
        .infer(field.value)
        ?.copy(
          false,
          true,
          this.context.typeStorage,
          this.context.document,
          this.context.scope,
          field.value
        );

      if (value == null) {
        continue; // skip if value is not inferable
      }

      newList.addElementType(value);
    }

    return newList;
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
