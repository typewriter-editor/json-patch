import { Delta } from '@typewriter/document';
import { beforeEach, describe, expect, it } from 'vitest';
import { JSONPatch } from '../src/jsonPatch';
import { createPatchProxy } from '../src/patchProxy';

interface TestType {
  foo: string;
  bar?: number;
  nested: {
    a: string;
    b?: boolean;
  };
  arr: Array<{ id: number; value: string } | string>;
  simpleArr: number[];
}

describe('Patch Proxy Utilities', () => {
  describe('createPatchProxy - Path Generation Mode', () => {
    const pathProxy = createPatchProxy<TestType>();

    it('should generate correct paths for top-level properties', () => {
      expect(pathProxy.foo.toString()).toBe('/foo');
      expect(pathProxy.bar!.toString()).toBe('/bar');
    });

    it('should generate correct paths for nested properties', () => {
      expect(pathProxy.nested.a.toString()).toBe('/nested/a');
      expect(pathProxy.nested.b!.toString()).toBe('/nested/b');
    });

    it('should generate correct paths for array indices', () => {
      expect(pathProxy.arr[0].toString()).toBe('/arr/0');
      expect(pathProxy.arr[123].toString()).toBe('/arr/123');
    });

    it('should generate correct paths for properties within array elements', () => {
      // Need to cast because TS doesn't know the element type at index 0 is the object
      // Cast specifically to the object shape within the union for this test
      const elementProxy = pathProxy.arr[0] as { id: number; value: string };
      expect(elementProxy.id.toString()).toBe('/arr/0/id');
      expect(elementProxy.value.toString()).toBe('/arr/0/value');
    });
  });

  describe('createPatchProxy - Automatic Patch Generation Mode', () => {
    let target: TestType;
    let patch: JSONPatch;
    let proxy: TestType;

    beforeEach(() => {
      target = {
        foo: 'hello',
        nested: { a: 'world' },
        arr: [{ id: 1, value: 'one' }, 'two'],
        simpleArr: [10, 20, 30],
      };
      patch = new JSONPatch();
      proxy = createPatchProxy(target, patch);
    });

    it('should generate replace op on property assignment', () => {
      proxy.foo = 'goodbye';
      expect(patch.ops).toEqual([{ op: 'replace', path: '/foo', value: 'goodbye' }]);
    });

    it('should generate replace op on nested property assignment', () => {
      proxy.nested.a = 'universe';
      expect(patch.ops).toEqual([{ op: 'replace', path: '/nested/a', value: 'universe' }]);
    });

    it('should generate add op for new optional property', () => {
      proxy.bar! = 123;
      expect(patch.ops).toEqual([{ op: 'replace', path: '/bar', value: 123 }]);
    });

    it('should generate remove op on assigning undefined', () => {
      proxy.bar = undefined;
      target.bar = 5; // Pretend it existed before
      proxy.bar = undefined;
      expect(patch.ops).toEqual([{ op: 'remove', path: '/bar' }]);
    });

    it('should generate remove op on assigning undefined to required prop', () => {
      // @ts-expect-error Testing assigning undefined to required prop
      proxy.foo = undefined;
      expect(patch.ops).toEqual([{ op: 'remove', path: '/foo' }]);
    });

    it('should generate remove op on delete', () => {
      // @ts-expect-error Testing delete on required property
      delete proxy.foo;
      expect(patch.ops).toEqual([{ op: 'remove', path: '/foo' }]);
      patch.ops = []; // Clear ops
      // @ts-expect-error Testing delete on required property
      delete proxy.nested.a;
      expect(patch.ops).toEqual([{ op: 'remove', path: '/nested/a' }]);
    });

    // --- Array Operations ---

    it('should generate add op for array push', () => {
      proxy.simpleArr.push(40);
      expect(patch.ops).toEqual([{ op: 'add', path: '/simpleArr/3', value: 40 }]);
      patch.ops = [];
      proxy.simpleArr.push(50, 60);
      expect(patch.ops).toEqual([
        { op: 'add', path: '/simpleArr/3', value: 50 },
        { op: 'add', path: '/simpleArr/4', value: 60 },
      ]);
    });

    it('should generate remove op for array pop', () => {
      proxy.simpleArr.pop();
      expect(patch.ops).toEqual([{ op: 'remove', path: '/simpleArr/2' }]);
    });

    it('should generate remove op for array shift', () => {
      proxy.simpleArr.shift();
      expect(patch.ops).toEqual([{ op: 'remove', path: '/simpleArr/0' }]);
    });

    it('should generate add ops for array unshift', () => {
      proxy.simpleArr.unshift(0, 5);
      expect(patch.ops).toEqual([
        { op: 'add', path: '/simpleArr/0', value: 0 },
        { op: 'add', path: '/simpleArr/1', value: 5 },
      ]);
    });

    it('should generate remove/add ops for array splice (delete)', () => {
      proxy.simpleArr.splice(1, 1); // Remove 1 element at index 1
      expect(patch.ops).toEqual([{ op: 'remove', path: '/simpleArr/1' }]);
    });

    it('should generate remove/add ops for array splice (insert)', () => {
      proxy.simpleArr.splice(1, 0, 15); // Insert 15 at index 1
      expect(patch.ops).toEqual([{ op: 'add', path: '/simpleArr/1', value: 15 }]);
    });

    it('should generate remove/add ops for array splice (replace)', () => {
      proxy.simpleArr.splice(1, 1, 15, 25); // Replace element at index 1 with 15, 25
      expect(patch.ops).toEqual([
        { op: 'remove', path: '/simpleArr/1' },
        { op: 'add', path: '/simpleArr/1', value: 15 },
        { op: 'add', path: '/simpleArr/2', value: 25 },
      ]);
    });

    it('should handle splice with negative start index', () => {
      proxy.simpleArr.splice(-1, 1); // Remove last element
      expect(patch.ops).toEqual([{ op: 'remove', path: '/simpleArr/2' }]);
    });

    it('should handle splice delete count exceeding array bounds', () => {
      proxy.simpleArr.splice(1, 5); // Try to remove 5 from index 1 (only 2 available)
      expect(patch.ops).toEqual([
        { op: 'remove', path: '/simpleArr/1' },
        { op: 'remove', path: '/simpleArr/1' }, // Path updates implicitly after first remove
      ]);
    });

    it('should generate replace op for nested optional property with non-null assertion', () => {
      // Add an optional nested property to the interface
      interface ExtendedTestType extends TestType {
        optionalNested?: {
          prop?: string;
        };
      }

      // Cast the proxy to the extended type
      const extendedProxy = proxy as unknown as ExtendedTestType;

      // Set a value on the optional nested property using non-null assertion
      extendedProxy.optionalNested!.prop = 'value';

      // Verify that the patch operation was generated correctly
      expect(patch.ops).toEqual([{ op: 'replace', path: '/optionalNested/prop', value: 'value' }]);
    });
  });

  describe('Special Operations', () => {
    interface TestType {
      text: Delta;
      counter: number;
      flags: number;
    }

    let target: TestType;
    let patch: JSONPatch;
    let proxy: TestType;

    beforeEach(() => {
      target = {
        text: new Delta().insert('Hello world'),
        counter: 10,
        flags: 0,
      };
      patch = new JSONPatch();
      proxy = createPatchProxy(target, patch);
    });

    describe('text operations', () => {
      it('should allow delta to be set', () => {
        proxy.text = new Delta().insert('New text');
        expect(patch.ops).toEqual([
          {
            op: 'replace',
            path: '/text',
            value: { ops: [{ insert: 'New text' }] },
          },
        ]);
      });

      it('should apply text delta with insert', () => {
        patch.text(proxy.text, new Delta().retain(5).insert(' beautiful'));
        expect(patch.ops).toEqual([
          {
            op: '@text',
            path: '/text',
            value: { ops: [{ retain: 5 }, { insert: ' beautiful' }] },
          },
        ]);
      });

      it('should apply text delta with delete', () => {
        patch.text(proxy.text, new Delta().retain(5).delete(1));
        expect(patch.ops).toEqual([
          {
            op: '@text',
            path: '/text',
            value: { ops: [{ retain: 5 }, { delete: 1 }] },
          },
        ]);
      });

      it('should apply text delta with array of ops', () => {
        patch.text(proxy.text, [{ retain: 5 }, { insert: ' beautiful' }]);
        expect(patch.ops).toEqual([
          {
            op: '@text',
            path: '/text',
            value: { ops: [{ retain: 5 }, { insert: ' beautiful' }] },
          },
        ]);
      });
    });

    describe('increment/decrement operations', () => {
      it('should be able to still set a number value', () => {
        proxy.counter = 20;
        expect(patch.ops).toEqual([
          {
            op: 'replace',
            path: '/counter',
            value: 20,
          },
        ]);
      });

      it('should increment with default value of 1', () => {
        patch.increment(proxy.counter);
        expect(patch.ops).toEqual([
          {
            op: '@inc',
            path: '/counter',
            value: 1,
          },
        ]);
      });

      it('should increment with specified value', () => {
        patch.increment(proxy.counter, 5);
        expect(patch.ops).toEqual([
          {
            op: '@inc',
            path: '/counter',
            value: 5,
          },
        ]);
      });

      it('should decrement with default value of 1', () => {
        patch.decrement(proxy.counter);
        expect(patch.ops).toEqual([
          {
            op: '@inc',
            path: '/counter',
            value: -1,
          },
        ]);
      });

      it('should decrement with specified value', () => {
        patch.decrement(proxy.counter, 3);
        expect(patch.ops).toEqual([
          {
            op: '@inc',
            path: '/counter',
            value: -3,
          },
        ]);
      });
    });

    describe('bit operations', () => {
      it('should set a bit', () => {
        patch.bit(proxy.flags, 2, true);
        expect(patch.ops).toEqual([
          {
            op: '@bit',
            path: '/flags',
            value: 4,
          },
        ]);
      });

      it('should clear a bit', () => {
        patch.bit(proxy.flags, 1, false);
        expect(patch.ops).toEqual([
          {
            op: '@bit',
            path: '/flags',
            value: 65536,
          },
        ]);
      });

      it('should work with multiple bit operations', () => {
        patch.bit(proxy.flags, 2, true);
        patch.bit(proxy.flags, 1, false);
        patch.bit(proxy.flags, 0, true);
        expect(patch.ops).toEqual([
          {
            op: '@bit',
            path: '/flags',
            value: 4,
          },
          {
            op: '@bit',
            path: '/flags',
            value: 65536,
          },
          {
            op: '@bit',
            path: '/flags',
            value: 1,
          },
        ]);
      });
    });

    describe('combining operations', () => {
      it('should support mixing different operations', () => {
        patch.text(proxy.text, new Delta().retain(5).insert(' beautiful'));
        patch.increment(proxy.counter, 5);
        patch.bit(proxy.flags, 2, true);
        patch.decrement(proxy.counter, 2);

        expect(patch.ops).toEqual([
          {
            op: '@text',
            path: '/text',
            value: { ops: [{ retain: 5 }, { insert: ' beautiful' }] },
          },
          {
            op: '@inc',
            path: '/counter',
            value: 5,
          },
          {
            op: '@bit',
            path: '/flags',
            value: 4,
          },
          {
            op: '@inc',
            path: '/counter',
            value: -2,
          },
        ]);
      });

      it('should support mixing special operations with regular operations', () => {
        proxy.text = new Delta().insert('direct set');
        patch.increment(proxy.counter, 5);
        patch.bit(proxy.flags, 2, true);

        expect(patch.ops).toEqual([
          {
            op: 'replace',
            path: '/text',
            value: { ops: [{ insert: 'direct set' }] },
          },
          {
            op: '@inc',
            path: '/counter',
            value: 5,
          },
          {
            op: '@bit',
            path: '/flags',
            value: 4,
          },
        ]);
      });
    });
  });
});
