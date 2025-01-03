import { Delta, Op } from '@typewriter/delta';
import { beforeEach, describe, expect, it } from 'vitest';
import { textDelta } from '../src/custom/delta.js';
import { JSONPatch } from '../src/jsonPatch.js';
import { JSONPatchOp } from '../src/types.js';

class JSONLikeObject {
  constructor(
    public firstName: string,
    public lastName: string
  ) {}
  toJSON() {
    return { name: this.firstName + ' ' + this.lastName };
  }
}

class MyJSONPatch extends JSONPatch {
  constructor(ops?: JSONPatchOp[]) {
    super(ops, { '@text': textDelta });
  }

  txt(path: string, value: Delta | Op[]) {
    const delta = Array.isArray(value) ? new Delta(value) : (value as Delta);
    if (!delta || !Array.isArray(delta.ops)) {
      throw new Error('Invalid Delta');
    }
    return this.op('@text', path, value);
  }
}

describe('JSONPatch', () => {
  let obj: any;
  let patch: MyJSONPatch;

  beforeEach(() => {
    obj = { test: true };
    patch = new MyJSONPatch();
  });

  it('can create a new object', () => {
    patch.add('', { test: false });
    obj = patch.apply(null);
    expect(obj).toEqual({ test: false });
  });

  it('throws an error for incorrect paths', () => {
    const add = () => patch.add('abc', { test: false });
    expect(add).toThrow('JSON Patch paths must begin with "/"');
  });

  it('can add values to an object', () => {
    patch.add('/name', 'Test');
    obj = patch.apply(obj);
    expect(obj).toEqual({ test: true, name: 'Test' });
  });

  it('can test for a value on an object before making changes', () => {
    patch.test('/test', true);
    patch.add('/name', 'Test');
    const apply = () => (obj = patch.apply(obj));
    expect(apply).not.toThrow();
    expect(obj).toEqual({ test: true, name: 'Test' });
  });

  it('can test for a value and use an object’s toJSON before making changes', () => {
    patch.test('/test', true);
    patch.add('/name', 'Test');
    const apply = () => (obj = patch.apply(obj));
    expect(apply).not.toThrow();
    expect(obj).toEqual({ test: true, name: 'Test' });
  });

  it('can fail a patch if the test does not pass', () => {
    patch.test('/test', false);
    patch.add('/name', 'Test');
    const apply = () => (obj = patch.apply(obj, { strict: true }));
    expect(apply).toThrow();
    expect(obj).toEqual({ test: true });
  });

  it('is does not mutate objects', () => {
    patch.add('/name', 'Test');
    const newObj = patch.apply(obj);
    expect(obj).not.toEqual(newObj);
  });

  it('can add values to an array', () => {
    obj.tags = ['test'];
    patch.add('/tags/0', 'foo');
    obj = patch.apply(obj);
    expect(obj).toEqual({ test: true, tags: ['foo', 'test'] });
  });

  it('can add values to the end of an array', () => {
    obj.tags = ['test'];
    patch.add('/tags/-', 'foo');
    obj = patch.apply(obj);
    expect(obj).toEqual({ test: true, tags: ['test', 'foo'] });
  });

  it('can remove a value from an object', () => {
    patch.remove('/test');
    obj = patch.apply(obj);
    expect(obj).toEqual({});
  });

  it('can remove a value from an array', () => {
    obj.tags = ['test', 'foo'];
    patch.remove('/tags/0');
    obj = patch.apply(obj);
    expect(obj).toEqual({ test: true, tags: ['foo'] });
  });

  it('can replace a value', () => {
    patch.replace('/test', false);
    obj = patch.apply(obj);
    expect(obj).toEqual({ test: false });
  });

  it('will use the JSON representation to add/replace a value', () => {
    patch.replace('/test', new JSONLikeObject('test', 'tester'));
    patch.add('/test2', new JSONLikeObject('test2', 'tester'));
    obj = patch.apply(obj);
    expect(obj).toEqual({ test: { name: 'test tester' }, test2: { name: 'test2 tester' } });
  });

  it('can replace a value in an array', () => {
    obj.tags = ['test', 'foo'];
    patch.replace('/tags/0', 'bar');
    obj = patch.apply(obj);
    expect(obj).toEqual({ test: true, tags: ['bar', 'foo'] });
  });

  it('can copy a value', () => {
    obj.uniqueValue = { name: 'test' };
    patch.copy('/test', '/test2');
    patch.copy('/uniqueValue', '/anotherValue');
    obj = patch.apply(obj);
    expect(obj).toEqual({
      test: true,
      test2: true,
      uniqueValue: { name: 'test' },
      anotherValue: { name: 'test' },
    });
    expect(obj.uniqueValue).toEqual(obj.anotherValue);
  });

  it('can copy a value into an array', () => {
    obj.tags = ['test'];
    patch.copy('/tags/0', '/tags/1');
    obj = patch.apply(obj);
    expect(obj).toEqual({ test: true, tags: ['test', 'test'] });
  });

  it('can move a value', () => {
    const tags = (obj.tags = ['test']);
    patch.move('/tags', '/tags2');
    patch.move('/test', '/test2');
    obj = patch.apply(obj);
    expect(obj).toEqual({ test2: true, tags2: ['test'] });
    expect(obj.tags2).toEqual(tags);
  });

  it('can increment a value', () => {
    obj.count = 5;
    patch.increment('/count', 2);
    obj = patch.apply(obj);
    expect(obj).toEqual({ count: 7, test: true });
    obj = new JSONPatch().decrement('/count', 3).apply(obj);
    expect(obj).toEqual({ count: 4, test: true });
    obj = new JSONPatch().increment('/newCount', 3).apply(obj);
    expect(obj).toEqual({ count: 4, newCount: 3, test: true });
  });

  it('can add a delta text value', () => {
    patch.txt('/text', new Delta().insert('This is my text.'));
    obj = patch.apply(obj);
    expect(obj.text).toEqual({ ops: [{ insert: 'This is my text.\n' }] });
  });

  it('can add a delta text value from ops', () => {
    patch.txt('/text', new Delta().insert('This is my text.').ops);
    obj = patch.apply(obj);
    expect(obj.text).toEqual({ ops: [{ insert: 'This is my text.\n' }] });
  });

  it('can update a delta text value', () => {
    obj.text = new Delta().insert('This is my text.\n');
    patch.txt('/text', new Delta().retain(11).insert('amazing '));
    obj = patch.apply(obj);
    expect(obj.text).toEqual({ ops: [{ insert: 'This is my amazing text.\n' }] });
  });

  it('can overwrite a value with a delta text value', () => {
    obj.text = new Date();
    patch.txt('/text', new Delta().insert('This is my text.'));
    obj = patch.apply(obj);
    expect(obj.text).toEqual({ ops: [{ insert: 'This is my text.\n' }] });
  });

  it('can update an ops value with a delta text value', () => {
    obj.text = new Delta().insert('This is my text.\n').ops;
    patch.txt('/text', new Delta().retain(11).insert('amazing '));
    obj = patch.apply(obj);
    expect(obj.text).toEqual({ ops: [{ insert: 'This is my amazing text.\n' }] });
  });

  it('will overwrite an array value that does not look like delta ops', () => {
    obj.text = [{ test: true }];
    patch.txt('/text', new Delta().insert('This is my text.'));
    obj = patch.apply(obj);
    expect(obj.text).toEqual({ ops: [{ insert: 'This is my text.\n' }] });
  });

  it('can work deeply', () => {
    obj.sub = {};
    patch.add('/sub/name', 'Test');
    obj = patch.apply(obj);
    expect(obj).toEqual({ test: true, sub: { name: 'Test' } });
  });

  it('throws an error when it cannot apply the patch', () => {
    patch.add('/sub/name', 'Test');
    const apply = () => (obj = patch.apply(obj, { strict: true }));
    expect(apply).toThrow();
  });

  it('throws an error when asked and it cannot apply text in the patch', () => {
    obj.text = new Delta().insert('This is my text.');
    patch.txt('/text', new Delta().retain(110).insert('amazing '));
    const apply = () => (obj = patch.apply(obj, { strict: true }));
    expect(apply).toThrow();
  });

  it('throws an error when adding text that is invalid', () => {
    const addText = () => patch.txt('/text', true as any);
    expect(addText).toThrow();
  });

  it('will add updates to an object', () => {
    patch.addUpdates({ test: undefined, name: 'test' });
    obj = patch.apply(obj);
    expect(obj).toEqual({ name: 'test' });
  });

  it('will add updates to a sub-object', () => {
    obj.sub = { name: 'test' };
    patch.addUpdates({ name: 'Test' }, '/sub');
    obj = patch.apply(obj);
    expect(obj).toEqual({ test: true, sub: { name: 'Test' } });
  });

  it('will create add operations for deep adds if needed', () => {
    patch.addObjectsInPath(obj, '/sub/obj/name');
    patch.add('/sub/obj/name', 'test');
    obj = patch.apply(obj);
    expect(obj).toEqual({ test: true, sub: { obj: { name: 'test' } } });
  });

  it('will create add operations for deep adds if needed', () => {
    obj.sub = {};
    patch.addObjectsInPath(obj, '/sub/obj/name');
    patch.add('/sub/obj/name', 'test');
    obj = patch.apply(obj);
    expect(obj).toEqual({ test: true, sub: { obj: { name: 'test' } } });
  });

  it('will apply changes to a sub-object', () => {
    obj.sub = { name: 'test' };
    patch.remove('/name');
    patch.add('/age', 2);
    obj = patch.apply(obj, { atPath: '/sub' });
    expect(obj).toEqual({ test: true, sub: { age: 2 } });
  });

  it('will reconstitue from JSON', () => {
    patch = MyJSONPatch.fromJSON(patch.add('/name', 'test').remove('/test').toJSON());
    obj = patch.apply(obj);
    expect(obj).toEqual({ name: 'test' });
  });

  describe('transform', () => {
    it('transforms over a patch or array of ops', () => {
      const other = new JSONPatch().move('/test', '/testing');
      patch.replace('/test', true);
      expect(other.transform(patch).ops).toEqual([{ op: 'replace', path: '/testing', value: true }]);
      expect(other.transform(patch.ops).ops).toEqual([{ op: 'replace', path: '/testing', value: true }]);
    });

    it('transforms soft writes', () => {
      const other = new JSONPatch().add('/test', false, { soft: true });
      patch.replace('/test', true, { soft: true });
      // Whichever patch is applied first will win
      expect(other.transform(patch).ops).toEqual([]);
      expect(patch.transform(other).ops).toEqual([]);
    });
  });

  describe('invert', () => {
    let inverted: any;

    beforeEach(() => {
      inverted = {
        test: false,
        name: 'test',
      };
    });

    it('will not invert test', () => {
      patch.test('/test', true);
      obj = patch.invert(inverted).apply(obj);
      expect(obj).toEqual({ test: true });
    });

    it('will invert add', () => {
      patch.add('/test', true);
      obj = patch.invert(inverted).apply(obj);
      expect(obj).toEqual({ test: false });

      obj.newProp = true;
      patch = new MyJSONPatch();
      patch.add('/newProp', true);
      obj = patch.invert(inverted).apply(obj);
      expect(obj).toEqual({ test: false });
    });

    it('will invert copy', () => {
      inverted.from = true;
      patch.copy('/from', '/test');
      obj = patch.invert(inverted).apply(obj);
      expect(obj).toEqual({ test: false });
    });

    it('will invert remove', () => {
      patch.remove('/test');
      obj = patch.invert(inverted).apply(obj);
      expect(obj).toEqual({ test: false });
    });

    it('will invert copy', () => {
      patch.copy('/test2', '/test');
      obj = patch.invert(inverted).apply(obj);
      expect(obj).toEqual({ test: false });
    });

    it('will invert move', () => {
      patch.move('/test2', '/test');
      obj = patch.invert(inverted).apply(obj);
      expect(obj).toEqual({ test2: true });
    });

    it('will invert an add/copy to an array', () => {
      inverted.tags = ['test'];
      obj.tags = ['foo', 'test'];
      patch.add('/tags/0', 'foo');

      obj = patch.invert(inverted).apply(obj);
      expect(obj).toEqual({ test: true, tags: ['test'] });

      obj.tags = ['foo', 'test'];
      patch = new MyJSONPatch();
      patch.copy('/name', '/tags/0');

      obj = patch.invert(inverted).apply(obj);
      expect(obj).toEqual({ test: true, tags: ['test'] });

      obj.tags = ['foo', 'test'];
      patch = new MyJSONPatch();
      patch.add('/tags/1', 'test');

      obj = patch.invert(inverted).apply(obj);
      expect(obj).toEqual({ test: true, tags: ['foo'] });
    });

    it('will invert an add to the end of an array', () => {
      inverted.tags = ['test'];
      obj.tags = ['test', 'foo'];
      patch.add('/tags/-', 'foo');

      obj = patch.invert(inverted).apply(obj);
      expect(obj).toEqual({ test: true, tags: ['test'] });
    });

    it('will throw an error on unknown operation', () => {
      patch.ops.push({ op: 'unknown' as 'add', path: '/x' });
      const invert = () => (obj = patch.invert(inverted).apply(obj));
      expect(invert).toThrow('Unknown patch operation, cannot invert');
    });

    it('will throw an error when the base object is incorrect', () => {
      patch.ops.push({ op: 'remove', path: '/x/y' });
      const invert = () => (obj = patch.invert({}).apply(obj, { strict: true }));
      expect(invert).toThrow(
        'Patch mismatch. This patch was not applied to the provided object and cannot be inverted.'
      );
    });
  });
});
