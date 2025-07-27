import { SignatureDefinitionBaseType } from 'meta-utils';

import { CompletionItemKind } from '../types/completion';
import { IDocument } from '../types/document';
import { ConstantIdentifier } from '../types/inference';
import { IScope } from '../types/scope';
import {
  IEntityInfo,
  IFunctionType,
  IMapType,
  ISA_PROPERTY,
  isMapType,
  IType,
  KeyValue,
  MAX_ALL_PROPERTIES_DEPTH,
  PropertyInfo,
  SymbolInfo,
  TypeKind
} from '../types/type';
import { EntityInfo } from './entity-info';
import { MapType } from './map-type';

export class Scope implements IScope {
  public readonly outer?: IScope;
  public readonly locals: MapType;
  public readonly document: IDocument;

  public globals: IScope;
  public associatedFunction?: IFunctionType;

  public readonly symbols: SymbolInfo[];

  constructor(document: IDocument, outer?: IScope) {
    this.document = document;
    this.outer = outer;
    this.locals = new MapType(
      document.typeStorage.generateId(TypeKind.MapType),
      null,
      null,
      document.typeStorage,
      document,
      this,
      null,
      null,
      true
    );
    this.globals = document.globals || this;
    this.symbols = [];
  }

  getSelf(): IType | undefined {
    return this.associatedFunction?.context;
  }

  getSuper(): IType | undefined {
    const self = this.getSelf();
    if (self == null || !isMapType(self)) return;
    return self.getProperty(ISA_PROPERTY)?.type;
  }

  getOuter(): IMapType | undefined {
    return this.outer?.getLocals();
  }

  getLocals(): IMapType {
    return this.locals;
  }

  getGlobals(): IMapType {
    return this.globals.getLocals();
  }

  setProperty(name: KeyValue, type: IType): void {
    if (typeof name !== 'string') return;
    this.locals.setProperty(name, new EntityInfo(name, type));
  }

  getProperty(name: KeyValue): IEntityInfo | undefined {
    if (this.locals.hasProperty(name)) {
      return this.locals.getProperty(name);
    } else if (this.outer?.hasProperty(name)) {
      return this.outer.locals.getProperty(name);
    } else if (this.globals.hasProperty(name)) {
      return this.globals.locals.getProperty(name);
    }

    return this.document.typeStorage.getTypePropertyById(
      SignatureDefinitionBaseType.General,
      name
    );
  }

  getAllProperties(depth: number = 1): PropertyInfo[] {
    if (depth > MAX_ALL_PROPERTIES_DEPTH) return [];
    const properties: Map<string, PropertyInfo> = new Map();
    const allProperties = [
      ...this.locals.getAllProperties(depth + 1),
      ...(this.globals !== this
        ? this.globals.getAllProperties(depth + 1)
        : []),
      ...(this.outer?.getAllProperties(depth + 1) || []),
      ...this.document.typeStorage
        .getTypeById(SignatureDefinitionBaseType.General)
        .getAllProperties(depth + 1)
    ];

    for (const property of allProperties) {
      if (!properties.has(property.name)) {
        properties.set(property.name, property);
      }
    }

    // Extend with constant identifiers if they are available
    if (
      !properties.has(ConstantIdentifier.Globals) &&
      this.getGlobals() != null
    ) {
      properties.set(ConstantIdentifier.Globals, {
        type: this.getGlobals(),
        name: ConstantIdentifier.Globals,
        kind: CompletionItemKind.Constant
      });
    }

    if (
      !properties.has(ConstantIdentifier.Locals) &&
      this.getLocals() != null
    ) {
      properties.set(ConstantIdentifier.Locals, {
        type: this.getLocals(),
        name: ConstantIdentifier.Locals,
        kind: CompletionItemKind.Constant
      });
    }

    if (!properties.has(ConstantIdentifier.Outer) && this.getOuter() != null) {
      properties.set(ConstantIdentifier.Outer, {
        type: this.getOuter(),
        name: ConstantIdentifier.Outer,
        kind: CompletionItemKind.Constant
      });
    }

    if (!properties.has(ConstantIdentifier.Self) && this.getSelf() != null) {
      properties.set(ConstantIdentifier.Self, {
        type: this.getSelf(),
        name: ConstantIdentifier.Self,
        kind: CompletionItemKind.Constant
      });
    }

    if (!properties.has(ConstantIdentifier.Super) && this.getSuper() != null) {
      properties.set(ConstantIdentifier.Super, {
        type: this.getSelf(),
        name: ConstantIdentifier.Super,
        kind: CompletionItemKind.Constant
      });
    }

    return Array.from(properties.values());
  }

  resolveAllAvailableWithQuery(query: string): SymbolInfo[] {
    const scopes: IScope[] = [this];

    if (this.outer) {
      scopes.push(this.outer);
    }

    if (this !== this.globals) {
      scopes.push(this.globals);
    }

    return scopes.flatMap((scope) =>
      scope.symbols.filter((symbol) => symbol.path.includes(query))
    );
  }

  hasProperty(key: KeyValue): boolean {
    return this.locals.hasProperty(key);
  }
}
