import { SignatureDefinition, SignatureDefinitionTypeMeta } from 'meta-utils';

export function isTypeMetaEqual(
  metaA: SignatureDefinitionTypeMeta,
  metaB: SignatureDefinitionTypeMeta
): boolean {
  return metaA.isEqual(metaB);
}

export function isSignatureDefinitionEqual(
  definitionA: SignatureDefinition,
  definitionB: SignatureDefinition
): boolean {
  return (
    definitionA === definitionB ||
    (definitionA.getOrigin() === definitionB.getOrigin() &&
      isTypeMetaEqual(definitionA.getType(), definitionB.getType()) &&
      definitionA.isProtected() === definitionB.isProtected() &&
      definitionA.getDescription() === definitionB.getDescription())
  );
}
