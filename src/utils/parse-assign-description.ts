import { Block, parse, Spec } from 'comment-parser';
import { SignatureDefinitionTypeMeta } from 'meta-utils';

import { createCommentBlock } from './create-comment-block';

export enum AssignTag {
  Define = 'define'
}

const AllowedAssignTags: Set<string> = new Set(Object.values(AssignTag));

function parseItemType(item: string): SignatureDefinitionTypeMeta {
  return SignatureDefinitionTypeMeta.fromString(item);
}

function parseAssign(def: Block) {
  const defineTag = def.tags.find((it) => it.tag === AssignTag.Define);

  if (!defineTag) {
    return null;
  }

  return {
    type: defineTag.type.split('|').map(parseItemType)
  };
}

function isSupportedTag(item: Pick<Spec, 'tag'>) {
  return AllowedAssignTags.has(item.tag);
}

export function parseAssignDescription(source: string) {
  const commentDefs = parse(createCommentBlock(source));
  const [commentDef] = commentDefs;
  const tags = commentDef.tags.filter(isSupportedTag);

  if (tags.length > 0) {
    return parseAssign(commentDef);
  }

  return null;
}
