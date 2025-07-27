import { normalizeText } from './normalize-text';

export const createCommentBlock = (comment: string): string => {
  return `/**
    ${comment
      .split('\n')
      .map((it) => {
        return `*${normalizeText(it)}`;
      })
      .join('\n')}
  */`;
};
