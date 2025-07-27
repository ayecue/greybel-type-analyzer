import type { ASTChunk } from 'miniscript-core';

import type { IDocument } from './document';
import { ITypeStorage } from './storage';

export const MAX_DEPTH = 30 as const;

export interface ModifyTypeStorageCallback {
  (document: IDocument, globalTypeStorage: ITypeStorage): void;
}

export interface ModifyTypeStorageMergeCallback {
  (target: IDocument, source: IDocument, globalTypeStorage: ITypeStorage): void;
}

export interface ITypeManager {
  readonly modifyTypeStorage?: ModifyTypeStorageCallback;
  readonly modifyTypeStorageMerge?: ModifyTypeStorageMergeCallback;

  analyze(identifier: string, chunk: ASTChunk): IDocument;
  get(identifier: string): IDocument | undefined;
}
