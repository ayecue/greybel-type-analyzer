import { Block, parse, Spec } from 'comment-parser';
import {
  SignatureDefinitionBaseType,
  SignatureDefinitionFunction,
  SignaturePayloadDefinitionArg,
  SignaturePayloadDefinitionTypeMeta,
  TypeParser
} from 'meta-utils';

import { ITypeStorage } from '../types/storage';
import { META_DOCS_SIGNATURE_ORIGIN, TypeKind } from '../types/type';
import { createCommentBlock } from './create-comment-block';

export enum FunctionBlockTag {
  Description = 'description',
  Param = 'param',
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

function parseFunctionBlock(def: Block) {
  const descriptions = [
    def.description ?? '',
    ...def.tags
      .filter(
        (it) => it.tag === FunctionBlockTag.Description || !isSupportedTag(it)
      )
      .map(parseDescription)
  ].join('\n\n');
  const args: SignaturePayloadDefinitionArg[] = def.tags
    .filter((it) => it.tag === FunctionBlockTag.Param)
    .map(parseArgType);
  let returns = def.tags
    .filter(
      (it) =>
        it.tag === FunctionBlockTag.Return ||
        it.tag === FunctionBlockTag.Returns
    )
    .flatMap(parseReturnType);
  const examples = def.tags
    .filter((it) => it.tag === FunctionBlockTag.Example)
    .map(parseExample);

  if (returns.length === 0) {
    returns = parseReturnType({ type: SignatureDefinitionBaseType.Any });
  }

  return {
    descriptions,
    args,
    returns,
    examples
  };
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

        return {
          types,
          opt,
          ...commentArgs[index],
          label
        };
      }),
      returns: commentReturn,
      description: commentDescription,
      example: commentExample
    }) as SignatureDefinitionFunction;
  }

  return item;
}
