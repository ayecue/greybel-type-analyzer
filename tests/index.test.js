const { getDocument } = require('./utils');
const { Entity, isUnionType, isMapType, isFunctionType, isListType, Type, EntityInfo, MapType } = require('../dist');
const { ASTType } = require('greybel-core');
const { SignatureDefinitionBaseType } = require('meta-utils');
const { nanoid } = require('nanoid');

describe('type-manager', () => {
  describe('1 level depth property', () => {
    test('should return entity', () => {
      const doc = getDocument(`test = "123"`);
      const scope = doc.globals;
      const item = scope.getProperty('test').type;

      expect(item.id).toEqual('string');
    });

    test('should return entity with multiple types', () => {
      const doc = getDocument(`
        test = "123"
        test = 123
      `);
      const scope = doc.globals;
      const item = scope.getProperty('test').type;

      expect(isUnionType(item)).toEqual(true);
      expect(item.variants.map((it) => it.getKeyType().id)).toEqual(['number', 'string']);
    });
  });

  describe('2 level depth property', () => {
    test('should return entity', () => {
      const doc = getDocument(`
        test = {}
        test.foo = 123
      `);
      const scope = doc.globals;
      const item = scope.getProperty('test').type;
      const subItem = item.getProperty('foo').type;

      expect(item.properties.size).toEqual(1);
      expect(isMapType(item)).toEqual(true);
      expect(subItem.id).toEqual('number');
    });

    test('should return entity with multiple types', () => {
      const doc = getDocument(`
        test = {}
        test.foo = 123
        test.foo = []
      `);
      const scope = doc.globals;
      const item = scope.getProperty('test').type;
      const subItem = item.getProperty('foo').type;

      expect(item.properties.size).toEqual(1);
      expect(isMapType(item)).toEqual(true);
      expect(isUnionType(subItem)).toEqual(true);
      expect(subItem.variants.map((it) => it.getKeyType().id)).toEqual(['list', 'number']);
    });

    test('should return entity with signature', () => {
      const doc = getDocument(`
        test = {}
        test.foo = []
        bar = test.foo.hasIndex
      `);
      const scope = doc.globals;
      const item = scope.getProperty('bar').type;

      expect(item.id).toEqual('number');
    });
  });

  describe('2 level depth property with index', () => {
    test('should return entity', () => {
      const doc = getDocument(`
        test = {}
        test[222] = "hello"
      `);
      const scope = doc.globals;
      const item = scope.getProperty('test').type;
      const numberKeyType = doc.typeStorage.getKeyTypeById('number');
      const subItem = item.getProperty(numberKeyType).type;

      expect(isMapType(item)).toEqual(true);
      expect(subItem.id).toEqual('string');
    });

    test('should return entity with multiple types', () => {
      const doc = getDocument(`
        test = {}
        test[222] = "hello"
        test[454] = {}
      `);
      const scope = doc.globals;
      const item = scope.getProperty('test').type;
      const numberKeyType = doc.typeStorage.getKeyTypeById('number');
      const subItem = item.getProperty(numberKeyType).type;

      expect(isMapType(item)).toEqual(true);
      expect(isUnionType(subItem)).toEqual(true);
      expect(subItem.variants.map((it) => it.getKeyType().id)).toEqual(['map', 'string']);
    });

    test('should return entity from key of type string', () => {
      const doc = getDocument(`
        test = {}
        test["foo"] = "hello"
        test["foo bar"] = "world"
      `);
      const scope = doc.globals;
      const item = scope.getProperty('test').type;
      const subItem = item.getProperty('foo').type;
      const subItem2 = item.getProperty('foo bar').type;

      expect(isMapType(item)).toEqual(true);
      expect(subItem.id).toEqual('string');
      expect(subItem2.id).toEqual('string');
    });

    test('should return entity from key of type any', () => {
      const doc = getDocument(`
        test = {
          "name": "test",
          123: "bar",
          234: 234,
          bar: 123
        }

        foo = test[bar]
      `);
      const scope = doc.globals;
      const item = scope.getProperty('foo').type;

      expect(item.id).toEqual('number');
    });

    test('should return entity properly depending on resolve chain', () => {
      const doc = getDocument(`
        test = {}

        // @return {string}
        test.testFn = function(a = 2, b = "test")
        end function

        a = test["testFn"]()
        b = test["testFn"]
        c = @test["testFn"]()
        d = @test["testFn"]

        e = @test.testFn
        f = @test.testFn()
        g = test.testFn
        h = test.testFn()
      `);
      const scope = doc.globals;

      expect(scope.getProperty('a').type.id).toEqual('string');
      expect(scope.getProperty('b').type.id).toEqual('function');
      expect(scope.getProperty('c').type.id).toEqual('string');
      expect(scope.getProperty('d').type.id).toEqual('function');
      expect(scope.getProperty('e').type.id).toEqual('function');
      expect(scope.getProperty('f').type.id).toEqual('string');
      expect(scope.getProperty('g').type.id).toEqual('string');
      expect(scope.getProperty('h').type.id).toEqual('string');
    });
  });

  describe('non identifier base', () => {
    test('should return entity from string literal', () => {
      const doc = getDocument(`
        // @return {number}
        string.test = function
        end function

        foo = "test".test
      `);
      const scope = doc.globals;
      const item = scope.getProperty('foo').type;

      expect(item.id).toEqual('number');
    });

    test('should return entity from number literal', () => {
      const doc = getDocument(`
        // @return {string}
        number.test = function
        end function

        foo = (123).test
      `);
      const scope = doc.globals;
      const item = scope.getProperty('foo').type;

      expect(item.id).toEqual('string');
    });

    test('should return entity from boolean literal', () => {
      const doc = getDocument(`
        // @return {string}
        number.test = function
        end function

        foo = (true).test
      `);
      const scope = doc.globals;
      const item = scope.getProperty('foo').type;

      expect(item.id).toEqual('string');
    });

    test('should return entity from expression', () => {
      const doc = getDocument(`
        // @return {number}
        string.test = function
        end function

        // @return {string}
        number.test = function
        end function

        foo = (1 + 2).test
      `);
      const scope = doc.globals;
      const item = scope.getProperty('foo').type;

      expect(item.id).toEqual('string');
    });

    test('should return entity from expression with binary operation', () => {
      const doc = getDocument(`
        // @return {number}
        string.test = function
        end function

        // @return {string}
        number.test = function
        end function

        foo = (1 + "test").test
      `);
      const scope = doc.globals;
      const item = scope.getProperty('foo').type;

      expect(item.id).toEqual('number');
    });
  });

  describe('globals', () => {
    test('should return entity from either global or api', () => {
      const doc = getDocument(`
        globals.remove
        remove
      `);
      const lineA = doc.chunk.lines[2][0];
      const lineB = doc.chunk.lines[3][0];
      const itemA = doc.resolveNamespace(lineA, false).item;
      const itemB = doc.resolveNamespace(lineB, false).item;

      expect(itemA.signature.getArguments().length).toEqual(1);
      expect(itemB.signature.getArguments().length).toEqual(2);
    });
  });

  describe('expression', () => {
    test('should return entity from isa', () => {
      const doc = getDocument(`
        test = "123" isa string
      `);
      const scope = doc.globals;
      const item = scope.getProperty('test').type;

      expect(item.id).toEqual('number');
    });
  });

  describe('function', () => {
    test('should return entity', () => {
      const doc = getDocument(`
        test = function(foo=123)
        end function
      `);
      const scope = doc.scopes[1].scope;
      const item = scope.getProperty('foo').type;

      expect(item.id).toEqual('number');
    });

    test('should return entity with multiple types', () => {
      const doc = getDocument(`
        test = function(foo=123)
          foo = "test"
        end function
      `);
      const scope = doc.scopes[1].scope;
      const item = scope.getProperty('foo').type;

      expect(isUnionType(item)).toEqual(true);
      expect(item.variants.map((it) => it.getKeyType().id)).toEqual(['string', 'number']);
    });

    test('should properly analyze even though syntax is invalid', () => {
      const doc = getDocument(`
        test = function(abc =)

        end function

        test
        foo = 123
      `)
      const scope = doc.globals;
      const item = scope.getProperty('foo').type;

      expect(item.id).toEqual('number');
    });

    test('should properly analyze even though expression is followed by slice expression', () => {
      const doc = getDocument(`
        foo = [1]
        bar = (foo + foo)[ : ]
      `)
      const scope = doc.globals;
      const item = scope.getProperty('bar').type;

      expect(item.getKeyType().id).toEqual('list');
    });
  });

  describe('intrinsics', () => {
    test('should return entity', () => {
      const doc = getDocument(`
        map.test = function(foo=123)
        end function
        fn = @map.test
        output = map.test
      `);
      const scope = doc.globals;
      const item = scope.getProperty('fn').type;
      const item2 = scope.getProperty('output').type;

      expect(isFunctionType(item)).toEqual(true);
      expect(item2.id).toEqual('null');
    });

    test('should return entity from extended intrinsics', () => {
      const doc = getDocument(`
        map.test = function(foo=123)
        end function
        fn = @{}.test
        output = {}.test
      `);
      const scope = doc.globals;
      const item = scope.getProperty('fn').type;
      const item2 = scope.getProperty('output').type;

      expect(isFunctionType(item)).toEqual(true);
      expect(item2.id).toEqual('null');
    });

    test('should return entity from extended intrinsics in resolve chain with method', () => {
      const doc = getDocument(`
        list.test = function(foo=123)
        end function
        fn = @join.split.test
        output = join.split.test
      `);
      const scope = doc.globals;
      const item = scope.getProperty('fn').type;
      const item2 = scope.getProperty('output').type;

      expect(isFunctionType(item)).toEqual(true);
      expect(item2.id).toEqual('null');
    });

    test('should return entity with custom definition', () => {
      const doc = getDocument(`
        map.hasIndex = function(a,b,c)
        end function

        bar = {}
        test = @bar.hasIndex
        bar.test = @bar.hasIndex
      `);
      const scope = doc.globals;
      const item = scope.getProperty('test').type;
      const item2 = scope.getProperty('bar').type.getProperty('test').type;

      expect(item.signature.getArguments().length).toEqual(3);
      expect(item2.signature.getArguments().length).toEqual(3);
    });
  });

  describe('merged', () => {
    test('should return entity', () => {
      const doc1 = getDocument(`
        map.test = function(foo=123)
        end function
      `);
      const doc2 = getDocument(`
        foo = @{}.test
      `);
      const mergedDoc = doc2.merge({ document: doc1 });
      const scope = mergedDoc.globals;
      const item = scope.getProperty('foo').type;

      expect(item.signature.getArguments().length).toEqual(1);
    });
  });

  describe('comment', () => {
    test('should return entity of return value', () => {
      const doc = getDocument(`
        // Hello world
        // I am **bold**
        // @param {string} test - The title of the book.
        // @param {string|number} abc - The author of the book.
        // @return {crypto} - Some info about return
        test = function(test, abc)
        end function
        output = test
      `);
      const scope = doc.globals;
      const signature = scope.getProperty('test').type.signature;
      const output = scope.getProperty('output').type;

      expect(signature.getArguments().length).toEqual(2);
      expect(signature.getReturns().map((it) => it.type)).toEqual(['crypto']);
      expect(output.id).toEqual('crypto');
    });

    test('should return any when missing return', () => {
      const doc = getDocument(`
        // Hello world
        // @param {number}
        test = function(a)
        end function
        output = test
      `);
      const scope = doc.globals;
      const returnType = scope.getProperty('test').type.getReturnType();

      expect(returnType.id).toEqual('any');
    });

    test('should use default return when invalid tag is used', () => {
      const doc = getDocument(`
        // @public
        // @description Hello world
        // @example print "test"
        // Hello world
        test = function(a)
        end function
        output = test
      `);
      const scope = doc.globals;
      const signature = scope.getProperty('test').type.signature;
      const returnType = signature.getReturns()[0];

      expect(signature.getDescription()).toContain('@public');
      expect(signature.getDescription()).not.toContain('@description');
      expect(signature.getExample().join('\n')).not.toContain('@example');
      expect(returnType.type).toEqual('any');
    });

    test('should override type resolve via define', () => {
      const doc = getDocument(`
        // @define {list<string>}
        foo = 123
      `);
      const scope = doc.globals;
      const item = scope.getProperty('foo').type;

      expect(isListType(item)).toEqual(true);
      expect(item.elementType.id).toEqual('string');
    });

    test('should return entity of nested return value', () => {
      const doc = getDocument(`
        // Hello world
        // @return {map<string,list<string>>} - Some info about return
        test = function
        end function
        output = test
      `);
      const scope = doc.globals;
      const signature = scope.getProperty('test').type.signature;
      const returnType = signature.getReturns()[0];

      expect(returnType.valueType.type).toEqual('list');
      expect(returnType.valueType.valueType.type).toEqual('string');
    });

    test('should return entity when using alternative return tag', () => {
      const doc = getDocument(`
        // Hello world
        // @returns {string} - Some info about return
        test = function
        end function
        output = test
      `);
      const scope = doc.globals;
      const signature = scope.getProperty('test').type.signature;
      const returnType = signature.getReturns()[0];

      expect(returnType.type).toEqual('string');
    });

    test('should return entities from arguments', () => {
      const doc = getDocument(`
        // Hello world
        // I am **bold**
        // @param {string} test - The title of the book.
        // @param {string|number} abc - The author of the book.
        // @param {list<string>|map<string,list<string>>} foo - Foobar.
        // @return {crypto} - Some info about return
        test = function(test, abc, foo)
        end function
        output = test
      `);
      const scope = doc.scopes[1].scope;
      const firstArg = scope.getProperty('test').type;
      const secondArg = scope.getProperty('abc').type;
      const thirdArg = scope.getProperty('foo').type;

      expect(firstArg.id).toEqual('string');
      expect(isUnionType(secondArg)).toEqual(true);
      expect(secondArg.variants.map((it) => it.getKeyType().id)).toEqual(['number', 'string']);
      expect(isUnionType(thirdArg)).toEqual(true);
      expect(thirdArg.variants.map((it) => it.getKeyType().id)).toEqual(['map', 'list']);
    });

    test('should return entity from arguments which has extended its type', () => {
      const doc = getDocument(`
        // Hello world
        // @return {string}
        map.bar = function

        end function

        // Hello world
        // @param {map} abc
        // @return {number}
        test = function(abc)
        end function
        output = test
      `);
      const scope = doc.scopes[2].scope;
      const arg = scope.getProperty('abc').type;

      expect(isMapType(arg)).toEqual(true);
      expect(arg.getProperty('bar').type.invoke().id).toEqual('string');
    });

    test('should return entity from arguments which has extended its type by merged doc', () => {
      const doc1 = getDocument(`
        // Hello world
        // @return {string}
        map.bar = function

        end function
      `);
      const doc2 = getDocument(`
        // Hello world
        // @param {map} abc
        // @return {number}
        test = function(abc)
        end function
        output = test
      `);
      const mergedDoc = doc2.merge({ document: doc1 });
      const scope = mergedDoc.scopes[1].scope;
      const arg = scope.getProperty('abc').type;

      expect(isMapType(arg)).toEqual(true);
      expect(arg.getProperty('bar').type.invoke().id).toEqual('string');
    });

    test('should return entity from nested function', () => {
      const doc = getDocument(`
        // @return {list<string>}
        foo = function
          // @param {string}
          // @param {string}
          // @return {list<string>}
          globals.test = function(a, b)

          end function
        end function
      `);
      const scope = doc.globals;
      const signature = scope.getProperty('test').type.signature;

      expect(signature.getArguments().length).toEqual(2);
      expect(signature.getArgument('a').getTypes().map((it) => it.type)).toEqual(['string']);
      expect(signature.getArgument('b').getTypes().map((it) => it.type)).toEqual(['string']);
      expect(signature.getReturns().map((it) => it.type)).toEqual(['list']);
    })
  });

  describe('comment parsing', () => {
    test('should return signature description without swallowing leading asterisk', () => {
      const doc = getDocument(`
        // **Hello** world
        test = function()
        end function

        // **Hello** world
        // another line
        foo = function()
        end function

        // **Hello** world
        // another line
        // @return {number}
        bar = function()
        end function
      `);
      const scope = doc.globals;
      const signatureTest = scope.getProperty('test').type.signature;
      const signatureFoo = scope.getProperty('foo').type.signature;
      const signatureBar = scope.getProperty('bar').type.signature;

      expect(signatureTest.getDescription()).toEqual("**Hello** world");
      expect(signatureFoo.getDescription()).toEqual("**Hello** world\n\nanother line");
      expect(signatureBar.getDescription()).toEqual("**Hello** world another line");
    });
  });

  describe('addressOf', () => {
    test('should return entity with signature', () => {
      const doc = getDocument(`
        foo = @hasIndex
      `);
      const scope = doc.globals;
      const signature = scope.getProperty('foo').type.signature;

      expect(signature.getArguments().length).toEqual(2);
      expect(signature.getReturns().map((it) => it.type)).toEqual(['number', 'null']);
    });

    test('should return entity signature return values', () => {
      const doc = getDocument(`
        foo = @hasIndex()
      `);
      const scope = doc.globals;
      const item = scope.getProperty('foo').type;

      expect(isUnionType(item)).toEqual(true);
      expect(item.variants.map((it) => it.getKeyType().id)).toEqual(['number', 'null']);
    });

    test('should return entity signature return values from object', () => {
      const doc = getDocument(`
        foo = @{}.hasIndex()
      `);
      const scope = doc.globals;
      const item = scope.getProperty('foo').type;

      expect(item.id).toEqual('number');
    });

    test('should return next entity', () => {
      const doc = getDocument(`
        foo = @split().join()
      `);
      const scope = doc.globals;
      const item = scope.getProperty('foo').type;

      expect(item.id).toEqual('string');
    });
  });

  describe('__isa', () => {
    test('should return entity', () => {
      const doc = getDocument(`
        test = {"foo":123}
        sub = new test
        foo = sub.foo
      `);
      const scope = doc.globals;
      const item = scope.getProperty('foo').type;

      expect(item.id).toEqual('number');
    });

    test('should return entity from 2 layer isa', () => {
      const doc = getDocument(`
        test = {"foo":123}
        test2 = new test
        sub = new test2
        foo = sub.foo
      `);
      const scope = doc.globals;
      const item = scope.getProperty('foo').type;

      expect(item.id).toEqual('number');
    });

    test('should return entity from 2 layer isa with override', () => {
      const doc = getDocument(`
        test = {"foo":123}
        test2 = new test
        test2.foo = "test"
        sub = new test2
        foo = sub.foo
      `);
      const scope = doc.globals;
      const item = scope.getProperty('foo').type;

      expect(item.id).toEqual('string');
    });

    test('should return entity from isa property', () => {
      const doc = getDocument(`
        test = {}
        test.foo = function(a, b, c)
        
        end function
        
        bar = @(new test).foo
      `);
      const scope = doc.globals;
      const signature = scope.getProperty('bar').type.signature;

      expect(signature.getArguments().length).toEqual(3);
    });

    test('should return entity from circular references', () => {
      const doc = getDocument(`
        globals.Test = {"value":"test"}
        Test.A = {
          "__isa": Test,
          "subvalue": "val a",
        }
        Test.B = {
          "__isa": Test,
          "subvalue": "val b",
        }
        Test.C = {
          "__isa": Test,
          "subvalue": "val c",
        }
        Test.D = {
          "__isa": Test,
          "subvalue": "val d",
        }
        Test.E = {
          "__isa": Test,
          "subvalue": "val e",
        }
        Test.F = {
          "__isa": Test,
          "subvalue": "val f",
        }
        Test.G = {
          "__isa": Test,
          "subvalue": "val g",
        }
        Test.H = {
          "__isa": Test,
          "subvalue": "val h",
        }
        Test.I = {
          "__isa": Test,
          "subvalue": "val i",
        }
        Test.J = {
          "__isa": Test,
          "subvalue": "val j",
        }
        Test.K = {
          "__isa": Test,
          "subvalue": "val k",
        }
        Test.L = {
          "__isa": Test,
          "subvalue": "val l",
        }
        Test.M = {
          "__isa": Test,
          "subvalue": "val m",
        }
        Test.N = {
          "__isa": Test,
          "subvalue": "val n",
        }
        Test.T = {
          "__isa": Test,
          "subvalue": "val t",
        }
        Test.U = {
          "__isa": Test,
          "subvalue": "val u",
        }
        Test.V = {
          "__isa": Test,
          "subvalue": "val v",
        }
        Test.X = {
          "__isa": Test,
          "subvalue": "val x",
        }
        Test.Y = {
          "__isa": Test,
          "subvalue": "val y",
        }
        Test.Z = {
          "__isa": Test,
          "subvalue": "val z",
        }
        Test.Q = {
          "__isa": Test,
          "subvalue": "val q",
        }
      `);
      const scope = doc.globals;
      const item = scope.getProperty('Test').type.getProperty('Q').type.getProperty('subvalue').type;
      const item2 = scope.getProperty('Test').type.getProperty('Q').type.getProperty('value').type;

      expect(item.id).toEqual('string');
      expect(item2.id).toEqual('string');
    });
  });

  describe('self', () => {
    test('should use self as context since context is available', () => {
      const doc = getDocument(`
        MyClass = {}
        MyClass.init = function
          self.foo = "12345"
          self.foo
        end function
      `);
      const line = doc.chunk.lines[5][0];
      const item = doc.resolveNamespace(line, false).item;

      expect(item.id).toEqual('string');
    });

    test('should use self as variable since no context is available', () => {
      const doc = getDocument(`
        MyClass = {}
        CreateClass = function
          self = new MyClass
          self.foo = "12345"
        end function
      `);
      const scope = doc.scopes[1].scope;
      const item = scope.getProperty('self').type;

      expect(item.getKeyType().id).toEqual('map');
      expect(item.getProperty('foo').type.id).toEqual('string');
    });
  });

  describe('super', () => {
    test('should return entity from __isa', () => {
      const doc = getDocument(`
        test = {}
        test.foo = function(a, b, c)
          super
        end function

        foo = new test
        foo.bar = function(a)
          super
        end function
      `);
      const lineA = doc.chunk.lines[4][0];
      const itemA = doc.resolveNamespace(lineA, false).item;
      const lineB = doc.chunk.lines[9][0];
      const itemB = doc.resolveNamespace(lineB, false).item;

      expect(itemA.id).toEqual('any');
      expect(itemB.getKeyType().id).toEqual('map');
    });

    test('should use super as variable since no context is available', () => {
      const doc = getDocument(`
        MyClass = {}
        CreateClass = function
          super = new MyClass
          super.foo = "12345"
        end function
      `);
      const scope = doc.scopes[1].scope;
      const item = scope.getProperty('super').type;
      const item2 = item.getProperty('foo').type;

      expect(item.getKeyType().id).toEqual('map');
      expect(item2.id).toEqual('string');
    });
  });

  describe('resolve all assignments', () => {
    test('should return all assignments which match query', () => {
      const doc = getDocument(`
        test = {"foo":123}
        bar = {"test":444}
        bar = function
          test = 123

          foo = function
            test = false
            bar.test = "42"
          end function
        end function
      `);
      const sources = doc.resolveAllAssignmentsWithQuery('test');

      expect(sources.length).toEqual(4);
      expect(sources[0].source[0].start.line).toEqual(2);
      expect(sources[1].source[0].start.line).toEqual(5);
      expect(sources[2].source[0].start.line).toEqual(8);
      expect(sources[3].source[0].start.line).toEqual(9);
    })
  });

  describe('resolve only visible assignments', () => {
    test('should return all assignments which match query', () => {
      const doc = getDocument(`
        level1 = "12345"
        bar = function
          level2 = 123

          foo = function
            level3 = false

            foo = function
              level4 = []
            end function
          end function
        end function
      `);
      const scope = doc.scopes[3].scope;
      const sources = scope.resolveAllAvailableWithQuery('level');

      expect(sources.length).toEqual(3);
      expect(sources[0].source[0].start.line).toEqual(10);
      expect(sources[1].source[0].start.line).toEqual(7);
      expect(sources[2].source[0].start.line).toEqual(2);
    });

    test('should return all assignments which match namespace', () => {
      const doc = getDocument(`
        tri = "12345"
        bar = function
          tri = 123

          foo = function
            tri = false

            foo = function
              tri = []
              tri
            end function
          end function
        end function
      `);
      const line = doc.chunk.lines[11];
      const sources = doc.resolveAvailableAssignments(line[0]);

      expect(sources.length).toEqual(3);
      expect(sources[0].source[0].start.line).toEqual(10);
      expect(sources[1].source[0].start.line).toEqual(7);
      expect(sources[2].source[0].start.line).toEqual(2);
    });

    test('should return all assignments even in instances', () => {
      const doc1 = getDocument(`
        // @type Bar
        Bar = {}
        Bar.moo = ""
        Bar.test = function(functionName)
          return self
        end function

        // @type Foo
        Foo = new Bar
        // @return {Foo}
        Foo.New = function(message)
          result = new Foo
          return result
        end function
      `);
      const doc2 = getDocument(`
        test = Foo.New
        test.test
      `);
      const mergedDoc = doc2.merge({ document: doc1 });
      const line = mergedDoc.chunk.lines[3];
      const item = mergedDoc.resolveNamespace(line[0], false).item;
      const sources = item.getSource();

      expect(sources.length).toEqual(1);
      expect(sources[0].start.line).toEqual(5);
    });

    test('should return all assignments even in instances with multiple assignment expressions', () => {
      const doc1 = getDocument(`
        // @type Bar
        Bar = {}
        Bar.moo = ""
        Bar.test = function(functionName)
          return self
        end function

        // @type Foo
        Foo = new Bar
        // @return {Foo}
        Foo.New = function(message)
          result = new Foo
          return result
        end function
      `);
      const doc2 = getDocument(`
        Foo = "was"
        test = Foo.New
        Foo
      `);
      const mergedDoc = doc2.merge({ document: doc1 });
      const line = mergedDoc.chunk.lines[4];
      const item = mergedDoc.resolveNamespace(line[0], false).item;
      const sources = item.getSource();

      expect(sources.length).toEqual(2);
      expect(sources[0].start.line).toEqual(2);
      expect(sources[1].start.line).toEqual(10);
    });

    test('should return all assignments in map constructor', () => {
      const doc1 = getDocument(`
        test = { "abc": "def" }
      `);
      const doc2 = getDocument(`
        test.abc
      `);
      const mergedDoc = doc2.merge({ document: doc1 });
      const line = mergedDoc.chunk.lines[2];
      const item = mergedDoc.resolveNamespace(line[0], false).item;
      const sources = item.getSource();

      expect(sources.length).toEqual(1);
      expect(sources[0].start.line).toEqual(2);
    });

    test('should return all assignments from different custom types', () => {
      const doc1 = getDocument(`
        // @type Bar
        // @property {string} virtualMoo
        // @property {string} nested.virtalMoo
        Bar = {}
        Bar.moo = ""

        // Hello world
        // I am **bold**
        // @return {Bar} - Some info about return
        Bar.test = function(test, abc)
          print("test")
          return self
        end function

        // @type Moo
        Moo = new Bar
        Moo.test = function
        end function
        // @return {Moo}
        Moo.New = function(message)
          result = new Moo
          return result
        end function

        // @type Foo
        Foo = new Bar
        // @return {Foo}
        Foo.New = function(message)
          result = new Foo
          return result
        end function

        // @return {Moo|Foo}
        myTestFunction = function
        end function

        myVar = myTestFunction
      `);
      const doc2 = getDocument(`
        myVar.test
      `);
      const mergedDoc = doc2.merge({ document: doc1 });
      const line = mergedDoc.chunk.lines[2];
      const item = mergedDoc.resolveNamespace(line[0], false).item;
      const sources = item.getSource();

      expect(sources.length).toEqual(2);
      expect(sources[0].start.line).toEqual(11);
      expect(sources[1].start.line).toEqual(18);
    });
  });

  describe('get identifiers', () => {
    test('should return all identifiers of one type', () => {
      const doc = getDocument(`
        test = []
      `);
      const scope = doc.globals;
      const identifiers = scope.getAllProperties();
      const identifierSet = new Set(identifiers.map(it => it.name));
      const entity = scope.getProperty('test').type;
      const entityIdentifiers = entity.getAllProperties();
      const entityIdentifierSet = new Set(entityIdentifiers.map(it => it.name));

      expect(identifiers.length).toEqual(58);
      expect(identifierSet.has('test')).toEqual(true);
      expect(entityIdentifiers.length).toEqual(15);
      expect(entityIdentifierSet.has('hasIndex')).toEqual(true);
    });

    test('should return all available identifiers in global scope', () => {
      const doc = getDocument(`
        map.test = function
          foo = "test"
        end function
        bar = 123
      `);
      const scope = doc.globals;
      const identifiers = scope.getAllProperties();
      const identifierSet = new Set(identifiers.map(it => it.name));

      expect(identifierSet.size).toEqual(58);
      expect(identifierSet.has('bar')).toEqual(true);
      expect(identifierSet.has('test')).toEqual(false);
      expect(identifierSet.has('foo')).toEqual(false);
    });

    test('should return all identifiers of one type', () => {
      const doc = getDocument(`
        test = unknown
      `);
      const scope = doc.globals;
      const entity = scope.getProperty('test').type;
      const entityIdentifiers = entity.getAllProperties();
      const entityIdentifierSet = new Set(entityIdentifiers.map(it => it.name));

      expect(entityIdentifierSet.size).toEqual(25);
      expect(entityIdentifierSet.has('hasIndex')).toEqual(true);
    });

    test('should return all identifiers of one type and custom intrinsics', () => {
      const doc = getDocument(`
        map.test = function(foo=123)
        end function
        test = unknown
      `);
      const scope = doc.globals;
      const entity = scope.getProperty('test').type;
      const entityIdentifiers = entity.getAllProperties();
      const entityIdentifierSet = new Set(entityIdentifiers.map(it => it.name));

      expect(entityIdentifierSet.size).toEqual(26);
      expect(entityIdentifierSet.has('test')).toEqual(true);
    });

    test('should return all identifiers of api', () => {
      const doc = getDocument(``);
      const identifiers = doc.globals.getAllProperties();

      expect(identifiers.length).toEqual(57);
    });

    test('should return all identifier with internal assigments having their source overriden', () => {
      const doc1 = getDocument(`
        // @type test
        test = { "abc": "def" }
        // @return {test}
        test.New = function
          return new self
        end function
      `);
      const doc2 = getDocument(`
        hello = test.New
      `);
      const mergedDoc = doc2.merge({ document: doc1 });
      const scope = mergedDoc.globals;
      const entityIdentifiers = scope.getAllProperties();

      expect(entityIdentifiers[0].type.getSource()[0].start.line).toEqual(3);
    });
  });

  describe('iterator', () => {
    test('should return string iterator', () => {
      const doc = getDocument(`
        foo = "was"

        for item in foo
        end for
      `);
      const scope = doc.globals;
      const item = scope.getProperty('item').type;

      expect(item.id).toEqual('string');
    });

    test('should return list iterator', () => {
      const doc = getDocument(`
        foo = [1, 2]

        for item in foo
        end for
      `);
      const scope = doc.globals;
      const item = scope.getProperty('item').type;

      expect(item.id).toEqual('number');
    });

    test('should return map iterator', () => {
      const doc = getDocument(`
        foo = {}
        foo.xxx = "was"

        for item in foo
        end for
      `);
      const scope = doc.globals;
      const item = scope.getProperty('item').type;

      expect(item.getKeyType().id).toEqual('map');
      expect(item.getProperty('key').type.id).toEqual('string');
      expect(item.getProperty('value').type.id).toEqual('string');
    });

    test('should return mixed iterator', () => {
      const doc = getDocument(`
        foo = "bar"
        foo = [1, 2]
        foo = {}
        foo.xxx = "was"

        for item in foo
        end for
      `);
      const scope = doc.globals;
      const item = scope.getProperty('item').type;

      expect(isUnionType(item)).toEqual(true);
      expect(item.variants.map((it) => it.getKeyType().id)).toEqual(['number', 'string', 'map']);
    });
  });

  describe('custom types', () => {
    test('should return entity of custom type', () => {
      const doc = getDocument(`
        // @type test
        foo = {}
        foo.xxx = "was"

        // @description This function returns a file!
        // @param {string} name
        // @return {test}
        bar = function
        end function


        abc = bar.xxx
      `);
      const scope = doc.globals;
      const item = scope.getProperty('abc').type;

      expect(item.id).toEqual('string');
    });

    test('should return nested entity of custom type', () => {
      const doc = getDocument(`
        // @type OtherCustomType
        // @property {string} foo
        // @property {number} test
        OtherCustomType = {}

        // @type CustomType
        // @property {list<string>} columns
        CustomType = {}

        item = CustomType.columns[2]
      `);
      const scope = doc.globals;
      const item = scope.getProperty('item').type;

      expect(item.id).toEqual('string');
    });

    test('should return entity of custom type virtual property', () => {
      const doc = getDocument(`
        // @type test
        // @property {number} moo
        foo = {}
        foo.xxx = "was"

        // @description This function returns a file!
        // @param {string} name
        // @return {test}
        bar = function
        end function


        abc = bar.moo
      `);
      const scope = doc.globals;
      const item = scope.getProperty('abc').type;

      expect(item.id).toEqual('number');
    });

    test('should return entity of custom type virtual nested property', () => {
      const doc = getDocument(`
        // @type test
        // @property {map} moo
        // @property {list} moo.bar
        foo = {}
        foo.xxx = "was"

        // @description This function returns a file!
        // @param {string} name
        // @return {test}
        bar = function
        end function


        abc = bar.moo.bar
      `);
      const scope = doc.globals;
      const item = scope.getProperty('abc').type;

      expect(item.getKeyType().id).toEqual('list');
    });

    test('should return entity of child custom type virtual nested property', () => {
      const doc = getDocument(`
        // @type test
        // @property {map} moo
        // @property {list} moo.bar
        foo = {}
        foo.xxx = "was"

        // @type teq
        teq = new foo

        // @description This function returns a file!
        // @param {string} name
        // @return {teq}
        bar = function
        end function


        abc = bar.moo.bar
      `);
      const scope = doc.globals;
      const item = scope.getProperty('abc').type;

      expect(item.getKeyType().id).toEqual('list');
    });

    test('should return entity of custom type on merged doc', () => {
      const doc1 = getDocument(`
        // @type test
        foo = {}
        foo.xxx = "was"

        // @description This function returns a file!
        // @param {string} name
        // @return {test}
        bar = function
        end function
      `);
      const doc2 = getDocument(`
        abc = bar.xxx
      `);
      const mergedDoc = doc2.merge({ document: doc1 });
      const scope = mergedDoc.globals;
      const item = scope.getProperty('abc').type;

      expect(item.id).toEqual('string');
    });

    test('should return identifier of custom type on merged doc', () => {
      const doc1 = getDocument(`
        // @type Bar
        // @property {string} virtualMoo
        Bar = {}
        Bar.moo = ""
        // @return {number}
        Bar.test = function(functionName)
          return self
        end function

        // @type Foo
        Foo = new Bar
        // @return {Foo}
        Foo.New = function(message)
          result = new Foo
          return result
        end function
      `);
      const doc2 = getDocument(`
        test = Foo.New
        abc = test.test
      `);
      const mergedDoc = doc2.merge({ document: doc1 });
      const scope = mergedDoc.globals;
      const item = scope.getProperty('abc').type;
      const item2 = scope.getProperty('test').type;

      expect(item.id).toEqual('number');
      expect(item2.getAllProperties().map((it) => it.name)).toEqual([
        '__isa',
        'New',
        'virtualMoo',
        'moo',
        'test',
        'remove',
        'push',
        'pull',
        'pop',
        'shuffle',
        'sum',
        'hasIndex',
        'indexOf',
        'indexes',
        'len',
        'values',
        'replace'
      ]);
    });
  });

  describe('cyclic references', () => {
    test('should resolve entity from cyclic references', () => {
      const doc = getDocument(`
        Bar = {}
        Bar = new Bar
        Bar.test = {"moo":"null"}


        Foo = {}
        Foo.__isa = Foo
        Foo.test = function(a, b)

        end function


        nad = new Foo
        nad.doesNotExist
      `);
      const scope = doc.globals;
      const entity = scope.getProperty('nad').type;
      const entityIdentifiers = entity.getAllProperties();

      expect(entity.getProperty('doesNotExist')).toBeUndefined();
      expect(entityIdentifiers.length).toEqual(14);
    });
  });

  // TODO: continue
  describe('resolve namespaces from import', () => {
    test('should resolve entity with type any', () => {
      const doc = getDocument(`
        #import HelloWord from "library/hello-world.src";
        #import HelloName from "library/hello-name.src";

        HelloWord // prints "Hello world!"
        HelloName("Joe") // prints "Hello Joe!"
      `);
      const scope = doc.globals;
      const helloWord = scope.getProperty('HelloWord').type;
      const helloName = scope.getProperty('HelloName').type;

      expect(helloName.id).toEqual('any');
      expect(helloWord.id).toEqual('any');
    });

    test('should resolve entity with type any and preset value', () => {
      const doc1 = getDocument(`
        #import HelloWord from "library/hello-world.src";
        #import HelloName from "library/hello-name.src";

        HelloWord // prints "Hello world!"
        HelloName("Joe") // prints "Hello Joe!"
      `);
      const doc2 = getDocument('');
      const exportType = new MapType(
        nanoid(),
        null,
        null,
        doc2.typeStorage,
        doc2,
        doc2.globals,
        null,
        doc2.typeStorage.getType(SignatureDefinitionBaseType.Map)
      );

      exportType.setProperty('exports', new EntityInfo('exports', Type.createBaseType('string', doc2.typeStorage), doc2, doc2.globals));
      doc2.globals.setProperty('module', exportType);

      const mergedDoc = doc1.merge({ document: doc2, namespaces: [{ exportFrom: 'module.exports', namespace: 'HelloWorld' }] });
      const scope = mergedDoc.globals;

      const item = scope.getProperty('HelloWorld').type;
      const item2 = scope.getProperty('HelloName').type;

      expect(item.id).toEqual('string');
      expect(item2.id).toEqual('any');
    });
  });

  describe('receive meta data from entity', () => {
    test('should resolve meta of list with singular type', () => {
      const doc = getDocument(`
        test = [1, 2, 3]
      `);
      const scope = doc.globals;

      expect(scope.getProperty('test').type.toMeta()).toEqual([{
        type: 'list',
        valueType: { type: 'number' }
      }]);
    });

    test('should resolve meta of list with multiple types', () => {
      const doc = getDocument(`
        test = [1, 2, 3, "foo"]
      `);
      const scope = doc.globals;

      expect(scope.getProperty('test').type.toMeta()).toEqual([
      { type: "list", valueType: { type: "string" } },
        { type: "list", valueType: { type: "number" } }
      ]);
    });

    test('should resolve meta of map with singular type', () => {
      const doc = getDocument(`
        test = { "foo": 123, "bar": 456 }
      `);
      const scope = doc.globals;

      expect(scope.getProperty('test').type.toMeta()).toEqual([{
        type: 'map',
        keyType: { type: 'string' },
        valueType: { type: 'number' }
      }]);
    });

    test('should resolve meta of map with multiple types', () => {
      const doc = getDocument(`
        test = { "foo": 123, "bar": "test" }
        test2 = { "foo": 123, 123: 456 }
      `);
      const scope = doc.globals;

      expect(scope.getProperty('test').type.toMeta()).toEqual([
        { keyType: { type: "string" }, type: "map", valueType: { type: "string" } },
        { keyType: { type: "string" }, type: "map", valueType: { type: "number" } }
      ]);
      expect(scope.getProperty('test2').type.toMeta()).toEqual([
        { keyType: { type: "number" }, type: "map", valueType: { type: "number" } },
        { keyType: { type: "string" }, type: "map", valueType: { type: "number" } }
      ]);
    });
  });
});