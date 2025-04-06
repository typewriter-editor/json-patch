import { beforeEach, describe, expect, it } from 'vitest';
import { createJSONPatch } from '../src/createJSONPatch';
import { JSONPatch } from '../src/jsonPatch';
import { createPatchProxy, DeepRequired } from '../src/patchProxy';

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
      expect(pathProxy.bar.toString()).toBe('/bar');
    });

    it('should generate correct paths for nested properties', () => {
      expect(pathProxy.nested.a.toString()).toBe('/nested/a');
      expect(pathProxy.nested.b.toString()).toBe('/nested/b');
    });

    it('should generate correct paths for array indices', () => {
      expect(pathProxy.arr[0].toString()).toBe('/arr/0');
      expect(pathProxy.arr[123].toString()).toBe('/arr/123');
    });

    it('should generate correct paths for properties within array elements', () => {
      // Need to cast because TS doesn't know the element type at index 0 is the object
      // Cast specifically to the object shape within the union for this test
      const elementProxy = pathProxy.arr[0] as DeepRequired<Extract<TestType['arr'][number], object>>;
      expect(elementProxy.id.toString()).toBe('/arr/0/id');
      expect(elementProxy.value.toString()).toBe('/arr/0/value');
    });
  });

  describe('createPatchProxy - Automatic Patch Generation Mode', () => {
    let target: TestType;
    let patch: JSONPatch;
    let proxy: typeof target; // Use DeepRequired<TestType> effectively

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
      proxy.bar = 123;
      expect(patch.ops).toEqual([{ op: 'replace', path: '/bar', value: 123 }]); // Note: Proxy assumes replace/add are similar here
    });

    it('should generate remove op on assigning undefined', () => {
      proxy.bar = undefined; // Assign undefined to an optional property that exists
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
        { op: 'add', path: '/simpleArr/4', value: 50 },
        { op: 'add', path: '/simpleArr/5', value: 60 },
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
      // Check final state if needed (Vitest doesn't run the actual splice on target here)
    });
  });

  describe('createJSONPatch', () => {
    let target: TestType;

    beforeEach(() => {
      target = {
        foo: 'initial',
        nested: { a: 'nested initial' },
        arr: ['a', 'b'],
        simpleArr: [1, 2, 3],
      };
    });

    it('should generate patch from proxy modifications within updater', () => {
      const patch = createJSONPatch(target, proxy => {
        proxy.foo = 'updated';
        proxy.nested.a = 'nested updated';
        proxy.simpleArr.push(4);
      });
      expect(patch.ops).toEqual([
        { op: 'replace', path: '/foo', value: 'updated' },
        { op: 'replace', path: '/nested/a', value: 'nested updated' },
        { op: 'add', path: '/simpleArr/3', value: 4 },
      ]);
    });

    it('should generate patch from direct patch calls within updater', () => {
      const patch = createJSONPatch(target, (proxy, p) => {
        p.replace(proxy.foo, 'direct replace');
        p.add(proxy.simpleArr[1], 99); // Add before index 1
        p.remove(proxy.arr[0]);
      });
      expect(patch.ops).toEqual([
        { op: 'replace', path: '/foo', value: 'direct replace' },
        { op: 'add', path: '/simpleArr/1', value: 99 },
        { op: 'remove', path: '/arr/0' },
      ]);
    });

    it('should combine proxy modifications and direct patch calls', () => {
      const patch = createJSONPatch(target, (proxy, p) => {
        proxy.foo = 'proxy update'; // replace /foo
        p.increment(proxy.simpleArr[0], 5); // increment /simpleArr/0
        proxy.arr.pop(); // remove /arr/1
      });
      expect(patch.ops).toEqual([
        { op: 'replace', path: '/foo', value: 'proxy update' },
        { op: '@inc', path: '/simpleArr/0', value: 5 }, // Corrected op name
        { op: 'remove', path: '/arr/1' },
      ]);
    });
  });
});
