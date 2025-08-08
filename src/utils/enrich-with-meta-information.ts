import { Block, parse, Spec } from 'comment-parser';
import {
  SignatureDefinitionBaseType,
  SignatureDefinitionFunction,
  SignaturePayloadDefinitionArg,
  SignaturePayloadDefinitionTypeMeta,
  TypeParser
} from 'meta-utils';

import { DEFAULT_CUSTOM_FUNCTION_DESCRIPTION } from '../types/inference';
import { ITypeStorage } from '../types/storage';
import { META_DOCS_SIGNATURE_ORIGIN, TypeKind } from '../types/type';
import { createCommentBlock } from './create-comment-block';

export enum FunctionBlockTag {
  Description = 'description',
  Param = 'param',
  Params = 'params',
  Return = 'return',
  Returns = 'returns',
  Example = 'example'
}

const AllowedFunctionBlockTags: Set<string> = new Set(
  Object.values(FunctionBlockTag)
);

function parseDescription(it: Spec): string {
  if (it.tag === FunctionBlockTag.Description) {
    return [it.name, it.description].filter((it) => it !== undefined).join(' ');
  }

  return [`@${it.tag}`, it.name, it.description]
    .filter((it) => it !== undefined)
    .join(' ');
}

function parseExample(it: Spec): string {
  return [it.name, it.description].filter((it) => it !== undefined).join(' ');
}

function parseItemType(item: string): SignaturePayloadDefinitionTypeMeta {
  return new TypeParser(item).parse();
}

function parseReturnType(
  commentType: Pick<Spec, 'type'>
): SignaturePayloadDefinitionTypeMeta[] {
  return commentType.type.split('|').map(parseItemType);
}

function parseArgType(
  commentType: Pick<Spec, 'type' | 'name' | 'optional'>
): SignaturePayloadDefinitionArg {
  return {
    types: commentType.type.split('|').map(parseItemType),
    label: commentType.name,
    opt: commentType.optional
  };
}

interface FunctionBlockDefinition {
  descriptions?: string;
  args?: SignaturePayloadDefinitionArg[];
  returns?: SignaturePayloadDefinitionTypeMeta[];
  examples?: string[];
}

function parseFunctionBlock(def: Block): FunctionBlockDefinition {
  const definition: FunctionBlockDefinition = {};
  const descriptions = [
    def.description ?? '',
    ...def.tags
      .filter(
        (it) => it.tag === FunctionBlockTag.Description || !isSupportedTag(it)
      )
      .map(parseDescription)
  ].join('\n\n');
  const args: SignaturePayloadDefinitionArg[] = def.tags
    .filter(
      (it) =>
        it.tag === FunctionBlockTag.Param || it.tag === FunctionBlockTag.Params
    )
    .map(parseArgType);
  const returns = def.tags
    .filter(
      (it) =>
        it.tag === FunctionBlockTag.Return ||
        it.tag === FunctionBlockTag.Returns
    )
    .flatMap(parseReturnType);
  const examples = def.tags
    .filter((it) => it.tag === FunctionBlockTag.Example)
    .map(parseExample);

  if (descriptions.length > 0) definition.descriptions = descriptions;
  if (args.length > 0) definition.args = args;
  if (returns.length > 0) definition.returns = returns;
  if (examples.length > 0) definition.examples = examples;

  return definition;
}

function isSupportedTag(item: Pick<Spec, 'tag'>) {
  return AllowedFunctionBlockTags.has(item.tag);
}

export function enrichWithMetaInformation(
  typeStorage: ITypeStorage,
  item: SignatureDefinitionFunction
): SignatureDefinitionFunction {
  const commentDefs = parse(createCommentBlock(item.getDescription()));
  const [commentDef] = commentDefs;
  const tags = commentDef.tags.filter(isSupportedTag);

  if (tags.length > 0) {
    const {
      descriptions: commentDescription,
      args: commentArgs,
      returns: commentReturn,
      examples: commentExample
    } = parseFunctionBlock(commentDef);

    return SignatureDefinitionFunction.parse(META_DOCS_SIGNATURE_ORIGIN, {
      id: typeStorage.generateId(TypeKind.FunctionType),
      type: SignatureDefinitionBaseType.Function,
      arguments: item.getArguments().map((item, index) => {
        const label = item.getLabel();
        const types = item.getTypes().map((it) => it.toString());
        const opt = item.isOptional();

        if (commentArgs && commentArgs[index]) {
          return {
            types,
            opt,
            ...commentArgs[index],
            label
          };
        }

        return {
          types,
          opt,
          label
        };
      }),
      returns: commentReturn || item.getReturns(),
      description: commentDescription || DEFAULT_CUSTOM_FUNCTION_DESCRIPTION,
      example: commentExample || item.getExample()
    }) as SignatureDefinitionFunction;
  }

  return item;
}
