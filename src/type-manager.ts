import { ASTChunk } from "miniscript-core";
import { Container } from "meta-utils";
import { GlobalTypeStorage } from "./storage/global-type-storage";
import { Document } from "./entities/document";
import { ITypeManager, ModifyTypeStorageCallback, ModifyTypeStorageMergeCallback } from "./types/type-manager";
import { TypeStorage } from "./storage/type-storage";

export interface TypeManagerOptions {
  container: Container;
  modifyTypeStorage?: ModifyTypeStorageCallback;
  modifyTypeStorageMerge?: ModifyTypeStorageMergeCallback;
}

export class TypeManager implements ITypeManager {
  private container: Container;
  private documents: Map<string, Document>;
  private typeStorage: GlobalTypeStorage;
  public readonly modifyTypeStorage?: ModifyTypeStorageCallback;
  public readonly modifyTypeStorageMerge?: ModifyTypeStorageMergeCallback;

  constructor(options: TypeManagerOptions) {
    this.documents = new Map();
    this.container = options.container;
    this.typeStorage = new GlobalTypeStorage();
    this.modifyTypeStorage = options.modifyTypeStorage;
    this.modifyTypeStorageMerge = options.modifyTypeStorageMerge;

    this.initializeTypeStorage();
  }

  private initializeTypeStorage(): void {
    this.typeStorage.insertPrimitives(this.container);
    this.typeStorage.insertNonPrimitives(this.container);
    this.typeStorage.insertAllAnyTypeMembers(this.container);
  }

  analyze(identifier: string, chunk: ASTChunk): Document {
    const document = new Document(identifier, chunk, this, this.typeStorage);
    document.aggregateVirtualSignatures();
    document.aggregateScopes();
    document.aggregateDefinitions();
    this.documents.set(identifier, document);
    return document;
  }

  get(identifier: string): Document | undefined {
    return this.documents.get(identifier);
  }
}