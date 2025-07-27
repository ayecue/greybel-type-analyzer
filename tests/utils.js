const { Parser } = require('greybel-core');
const { miniscriptMeta } = require('miniscript-meta');
const { TypeManager, createProxyForNativeType, EntityInfo, persistTypeInNativeFunction } = require('../dist');
const { SignatureDefinitionBaseType } = require('meta-utils');

const parse = (code) => {
  const parser = new Parser(code, { unsafe: true });
  return parser.parseChunk();
};

exports.parse = parse;

const getDocument = (code) => {
  const typeManager = new TypeManager({
    container: miniscriptMeta
  });
  const id = (Math.random() + 1).toString(36).substring(7);

  return typeManager.analyze(id, parse(code));
}

exports.getDocument = getDocument;