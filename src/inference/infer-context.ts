import { IDocument, OnRequestScopeCallback } from '../types/document';
import { IInferContext } from '../types/inference';
import { IScope } from '../types/scope';
import { ITypeStorage } from '../types/storage';

export class InferContext implements IInferContext {
  readonly typeStorage: ITypeStorage;
  readonly document: IDocument;
  readonly scope: IScope;
  readonly onRequestScope?: OnRequestScopeCallback;

  constructor(
    typeStorage: ITypeStorage,
    document: IDocument,
    scope: IScope,
    onRequestScope?: OnRequestScopeCallback
  ) {
    this.typeStorage = typeStorage;
    this.document = document;
    this.scope = scope;
    this.onRequestScope = onRequestScope;
  }
}
