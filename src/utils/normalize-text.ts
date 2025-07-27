export const normalizeText = (text: string): string => {
  return text.trimLeft().replace(/\r$/, '');
};
