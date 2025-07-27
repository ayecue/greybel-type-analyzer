# greybel-type-analyzer

[![greybel-type-analyzer](https://circleci.com/gh/ayecue/greybel-type-analyzer.svg?style=svg)](https://circleci.com/gh/ayecue/greybel-type-analyzer)

A static type analyzer for Greybel/MiniScript that provides comprehensive type inference, symbol resolution, and code intelligence features. This package performs static code analysis to determine variable types, function signatures, and object properties, enabling advanced IDE features like autocompletion, type checking, and refactoring.

## Features

- **Type Inference**: Automatically infers types for variables, functions, and complex expressions
- **Symbol Resolution**: Resolves identifiers across scopes and namespaces  
- **JSDoc Support**: Parses JSDoc-style comments for enhanced type information
- **Document Merging**: Combines multiple code documents for cross-file analysis
- **Completion Support**: Provides autocompletion data for IDE integration
- **Union Types**: Handles variables with multiple possible types
- **Custom Types**: Supports user-defined types and inheritance via `__isa`

## Installation

```bash
npm install greybel-type-analyzer
```

## Basic Usage

```ts
import { TypeManager } from 'greybel-type-analyzer';
import { miniscriptMeta } from 'miniscript-meta';
import { Parser } from 'greybel-core';

const typeManager = new TypeManager({
  container: miniscriptMeta
});

const code = `
  myVar = "hello"
  myNumber = 123
  myMap = { "key": "value" }
`;

const parser = new Parser(code, { unsafe: true });
const chunk = parser.parseChunk();
const document = typeManager.analyze('main.gs', chunk);

// Get all global properties
const globals = document.globals.getAllProperties();
console.log(`Found ${globals.length} global identifiers`);

// Get type of specific variable
const myVarType = document.globals.getProperty('myVar').type;
console.log(`myVar type: ${myVarType.id}`); // "string"
```

## Advanced Features

### Type Annotations with JSDoc

```ts
const code = `
  // @param {string} name - User name
  // @param {number} age - User age  
  // @return {map} User object
  createUser = function(name, age)
    return { "name": name, "age": age }
  end function
`;

const document = typeManager.analyze('users.gs', code);
const func = document.globals.getProperty('createUser').type;
const signature = func.signature;

console.log(signature.getArguments()); // Gets parameter info
console.log(signature.getReturns());   // Gets return type info
```

### Document Merging

```ts
// Analyze multiple files and merge for cross-file type resolution
const doc1 = typeManager.analyze('utils.gs', utilsCode);
const doc2 = typeManager.analyze('main.gs', mainCode);

const mergedDoc = doc2.merge({ document: doc1 });
// Now main.gs can see types from utils.gs
```

### Symbol Resolution

```ts
// Resolve symbol at specific code position
const line = document.chunk.lines[5][0]; // Get AST node
const result = document.resolveNamespace(line, false);
console.log(result.item.id); // Type of symbol at that position
```

## API Reference

### Core Classes

- **[`TypeManager`](src/type-manager.ts)**: Main entry point for type analysis
- **[`IDocument`](src/types/document.ts)**: Represents analyzed document with type information  
- **[`IScope`](src/types/scope.ts)**: Represents variable scope (global, function, etc.)
- **[`IType`](src/types/type.ts)**: Base interface for all type information

### Type System

The analyzer supports these type kinds:
- `string`, `number`, `list`, `map` - Basic types
- `function` - Function types with signatures
- `union` - Variables that can be multiple types
- `unknown` - For unresolved or dynamic types
- Custom types defined via JSDoc `@type` annotations

## Compatible ASTs

This package works with AST output from:
- [greybel-core](https://github.com/ayecue/greybel-core) (recommended)
- [miniscript-core](https://github.com/ayecue/miniscript-core)