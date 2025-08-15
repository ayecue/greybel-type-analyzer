import { Block, parse, Spec } from 'comment-parser';
import {
  SignatureDefinitionBaseType,
  SignaturePayloadDefinitionContainer,
  SignaturePayloadDefinitionFunction,
  TypeParser
} from 'meta-utils';

import { createCommentBlock } from './create-comment-block';

export enum VirtualTypeTag {
  Main = 'vtype',
  Extends = 'extends',
  Function = 'function',
  Param = 'param',
  Params = 'params',
  Return = 'return',
  Returns = 'returns',
  Description = 'description',
  Example = 'example',
  Property = 'property'
}

const AllowedTags: Set<string> = new Set(Object.values(VirtualTypeTag));

export const VIRTUAL_TYPE_MAIN_TAG = '@' + VirtualTypeTag.Main;
export const VIRTUAL_TYPE_MAIN_TAG_REGEX = new RegExp(
  `^${VIRTUAL_TYPE_MAIN_TAG}\\s+([a-zA-Z0-9_]+)`
);

function isSupportedTag(item: Pick<Spec, 'tag'>) {
  return AllowedTags.has(item.tag);
}

export interface VirtualType {
  type: string;
  extends: string | null;
  definitions: SignaturePayloadDefinitionContainer;
}

function parseText(it: Spec): string {
  return [it.name, it.description].filter((it) => it !== undefined).join(' ');
}

class VirtualTypeParser {
  private block: Block;
  private virtualType: VirtualType | null;
  private pointer: number = 1; // Start after the main tag

  constructor(block: Block) {
    this.block = block;
    this.virtualType = this.createInitialVirtualType();
  }

  private createInitialVirtualType(): VirtualType {
    const mainTag = this.block.tags[0];

    if (mainTag.tag !== VirtualTypeTag.Main) {
      return null;
    }

    return {
      type: mainTag.name,
      extends: null,
      definitions: {}
    };
  }

  private parseFunction(tag: Spec): void {
    const functionName = tag.name;
    const functionDef: SignaturePayloadDefinitionFunction = {
      id: `${this.virtualType.type}:${functionName}`,
      type: SignatureDefinitionBaseType.Function,
      arguments: [],
      returns: [],
      example: [],
      description: ''
    };

    // Look ahead for function-related tags
    while (this.pointer < this.block.tags.length) {
      const nextTag = this.block.tags[this.pointer];
      if (
        nextTag.tag === VirtualTypeTag.Function ||
        nextTag.tag === VirtualTypeTag.Property ||
        nextTag.tag === VirtualTypeTag.Extends
      ) {
        break; // Start of next definition
      }
      switch (nextTag.tag) {
        case VirtualTypeTag.Description:
          functionDef.description += parseText(nextTag) + '\n';
          break;
        case VirtualTypeTag.Example:
          functionDef.example.push(parseText(nextTag));
          break;
        case VirtualTypeTag.Param:
        case VirtualTypeTag.Params:
          functionDef.arguments.push({
            label: nextTag.name,
            type: nextTag.type
              ? new TypeParser(nextTag.type).parse()
              : SignatureDefinitionBaseType.Any
          });
          break;
        case VirtualTypeTag.Return:
        case VirtualTypeTag.Returns:
          functionDef.returns.push(
            nextTag.type
              ? new TypeParser(nextTag.type).parse()
              : SignatureDefinitionBaseType.Any
          );
          break;
      }
      this.pointer++;
    }

    if (functionDef.example.length === 0) {
      functionDef.example = null;
    }

    if (functionDef.description.length === 0) {
      functionDef.description = null;
    }

    if (functionDef.returns.length === 0) {
      functionDef.returns.push(SignatureDefinitionBaseType.Any);
    }

    this.virtualType.definitions[functionName] = functionDef;
  }

  private parseProperty(tag: Spec): void {
    const propertyName = tag.name;

    this.virtualType.definitions[propertyName] = {
      type: tag.type
        ? new TypeParser(tag.type).parse()
        : SignatureDefinitionBaseType.Any
    };
  }

  process(): VirtualType | null {
    if (!this.virtualType) {
      return null;
    }

    while (this.pointer < this.block.tags.length) {
      const tag = this.block.tags[this.pointer];

      switch (tag.tag) {
        case VirtualTypeTag.Extends:
          this.virtualType.extends = tag.name;
          break;
        case VirtualTypeTag.Function:
          this.parseFunction(tag);
          break;
        case VirtualTypeTag.Property:
          this.parseProperty(tag);
          break;
        case VirtualTypeTag.Description:
        case VirtualTypeTag.Example:
        case VirtualTypeTag.Param:
        case VirtualTypeTag.Params:
        case VirtualTypeTag.Return:
        case VirtualTypeTag.Returns:
          // These tags are handled within function or property parsing
          break;
        default:
          // Ignore unsupported tags
          break;
      }
      this.pointer++;
    }

    return this.virtualType;
  }
}

function parseVirtualTypeBlock(def: Block): VirtualType | null {
  return new VirtualTypeParser(def).process();
}

export function parseVirtualType(source: string) {
  const commentDefs = parse(createCommentBlock(source));
  const [commentDef] = commentDefs;
  const tags = commentDef.tags.filter(isSupportedTag);

  if (tags.length > 0) {
    return parseVirtualTypeBlock(commentDef);
  }

  return null;
}
