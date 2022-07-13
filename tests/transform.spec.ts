import { expect } from 'chai';
import { transformPatch as originalTransformPatch } from '../src/transformPatch';
import { text } from '../src/custom-types/delta';
import { JSONPatchOp, verbose } from '../src';

const matrix = [[],[],[],[],[],[],[]];
const arr = [{},{},{},{},{},{},{}];
const obj = {x:arr};

describe('transformPatch', () => {
  // verbose(true);
  const types = {
    '@changeText': text,
  };

  function transformPatch(obj: any, ops: JSONPatchOp[], overOps: JSONPatchOp[], priority?: boolean) {
    return originalTransformPatch(obj, ops, overOps, priority, types);
  }

  describe('map/hash/dictionary/lookup', () => {
    it('does not overwrite empty objects used for lookups', () => {
      expect(transformPatch({}, [
        { op: 'add', path: '/obj', value: {} },
        { op: 'add', path: '/obj/foo', value: {} }
      ], [
        { op: 'add', path: '/obj', value: {} },
        { op: 'add', path: '/obj/foo', value: {} },
        { op: 'add', path: '/obj/foo/bar', value: {} },
      ])).to.deep.equal([]);
    })
  });

  describe('array', () => {
    it('ensure non-arrays are handled as properties', () => {
      expect(transformPatch({}, [{ op: 'add', path: '/1', value: 'hi1' }], [{ op: 'add', path: '/0', value: 'x' }])).to.deep.equal([{ op: 'add', path: '/1', value: 'hi1' }]);
    })

    it('bumps paths when list elements are inserted or removed', () => {
      expect(transformPatch(matrix, [{ op: 'add', path: '/1', value: 'hi1' }], [{ op: 'add', path: '/0', value: 'x' }])).to.deep.equal([{ op: 'add', path: '/2', value: 'hi1' }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/0', value: 'hi2' }], [{ op: 'add', path: '/0', value: 'x'}])).to.deep.equal([{ op: 'add', path: '/0', value: 'hi2' }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/0', value: 'hi3' }], [{ op: 'add', path: '/1', value: 'x'}])).to.deep.equal([{ op: 'add', path: '/0', value: 'hi3' }]);
      expect(transformPatch(matrix, [{ op: '@changeText', path: '/1', value: []}], [{ op: 'add', path: '/0', value: 'x' }])).to.deep.equal([{ op: '@changeText', path: '/2', value: []}]);
      expect(transformPatch(matrix, [{ op: '@changeText', path: '/0', value: []}], [{ op: 'add', path: '/0', value: 'x' }])).to.deep.equal([{ op: '@changeText', path: '/1', value: []}]);
      expect(transformPatch(matrix, [{ op: '@changeText', path: '/0', value: []}], [{ op: 'add', path: '/1', value: 'x' }])).to.deep.equal([{ op: '@changeText', path: '/0', value: []}]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/1', value: 'hi1' }], [{ op: 'copy', from: '/x', path: '/0'  }])).to.deep.equal([{ op: 'add', path: '/2', value: 'hi1' }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/0', value: 'hi2' }], [{ op: 'copy', from: '/x', path: '/0' }])).to.deep.equal([{ op: 'add', path: '/0', value: 'hi2' }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/0', value: 'hi3' }], [{ op: 'copy', from: '/x', path: '/1' }])).to.deep.equal([{ op: 'add', path: '/0', value: 'hi3' }]);

      expect(transformPatch(matrix, [{ op: 'add', path: '/1', value: 'hi4' }], [{ op: 'remove', path: '/0' }])).to.deep.equal([{ op: 'add', path: '/0', value: 'hi4' }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/0', value: 'hi5' }], [{ op: 'remove', path: '/1' }])).to.deep.equal([{ op: 'add', path: '/0', value: 'hi5' }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/0', value: 'hi6' }], [{ op: 'remove', path: '/0' }])).to.deep.equal([{ op: 'add', path: '/0', value: 'hi6' }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/2', value: 'hi7' }], [{ op: 'remove', path: '/2' }])).to.deep.equal([{ op: 'add', path: '/2', value: 'hi7' }]);
      expect(transformPatch(obj, [{ op: 'add', path: '/x/3/x', value: 'hi8' }], [{ op: 'add', path: '/x/5', value: 'x' }])).to.deep.equal([{ op: 'add', path: '/x/3/x', value: 'hi8' }]);
      expect(transformPatch(obj, [{ op: 'add', path: '/x/3/x', value: 'hi9' }], [{ op: 'add', path: '/x/0', value: 'x' }])).to.deep.equal([{ op: 'add', path: '/x/4/x', value: 'hi9' }]);
      expect(transformPatch(obj, [{ op: 'add', path: '/x/3/x', value: 'hi9' }], [{ op: 'add', path: '/x/3', value: 'x' }])).to.deep.equal([{ op: 'add', path: '/x/4/x', value: 'hi9' }]);
      expect(transformPatch(matrix, [{ op: '@changeText', path: '/1', value: [] }], [{ op: 'remove', path: '/0' }])).to.deep.equal([{ op: '@changeText', path: '/0', value: [] }]);
      expect(transformPatch(matrix, [{ op: '@changeText', path: '/0', value: [] }], [{ op: 'remove', path: '/1' }])).to.deep.equal([{ op: '@changeText', path: '/0', value: [] }]);
      expect(transformPatch(matrix, [{ op: '@changeText', path: '/0', value: [] }], [{ op: 'remove', path: '/0' }])).to.deep.equal([{ op: 'add', path: '/0', value: null }, { op: '@changeText', path: '/0', value: [] }]);

      expect(transformPatch(matrix, [{ op: 'remove', path: '/0' }], [{ op: 'add', path: '/0', value: 'x' }])).to.deep.equal([{ op: 'remove', path: '/1' }]);
    })

    it('bumps paths when list elements are inserted or removed with priority', () => {
      expect(transformPatch(matrix, [{ op: 'add', path: '/1', value: 'hi1' }], [{ op: 'add', path: '/0', value: 'x' }], true)).to.deep.equal([{ op: 'add', path: '/2', value: 'hi1' }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/0', value: 'hi2' }], [{ op: 'add', path: '/0', value: 'x'}], true)).to.deep.equal([{ op: 'add', path: '/1', value: 'hi2' }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/0', value: 'hi3' }], [{ op: 'add', path: '/1', value: 'x'}], true)).to.deep.equal([{ op: 'add', path: '/0', value: 'hi3' }]);
      expect(transformPatch(matrix, [{ op: '@changeText', path: '/1', value: []}], [{ op: 'add', path: '/0', value: 'x' }], true)).to.deep.equal([{ op: '@changeText', path: '/2', value: []}]);
      expect(transformPatch(matrix, [{ op: '@changeText', path: '/0', value: []}], [{ op: 'add', path: '/0', value: 'x' }], true)).to.deep.equal([{ op: '@changeText', path: '/1', value: []}]);
      expect(transformPatch(matrix, [{ op: '@changeText', path: '/0', value: []}], [{ op: 'add', path: '/1', value: 'x' }], true)).to.deep.equal([{ op: '@changeText', path: '/0', value: []}]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/1', value: 'hi1' }], [{ op: 'copy', from: '/x', path: '/0'  }], true)).to.deep.equal([{ op: 'add', path: '/2', value: 'hi1' }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/0', value: 'hi2' }], [{ op: 'copy', from: '/x', path: '/0' }], true)).to.deep.equal([{ op: 'add', path: '/1', value: 'hi2' }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/0', value: 'hi3' }], [{ op: 'copy', from: '/x', path: '/1' }], true)).to.deep.equal([{ op: 'add', path: '/0', value: 'hi3' }]);

      expect(transformPatch(matrix, [{ op: 'add', path: '/1', value: 'hi4' }], [{ op: 'remove', path: '/0' }], true)).to.deep.equal([{ op: 'add', path: '/0', value: 'hi4' }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/0', value: 'hi5' }], [{ op: 'remove', path: '/1' }], true)).to.deep.equal([{ op: 'add', path: '/0', value: 'hi5' }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/0', value: 'hi6' }], [{ op: 'remove', path: '/0' }], true)).to.deep.equal([{ op: 'add', path: '/0', value: 'hi6' }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/2', value: 'hi7' }], [{ op: 'remove', path: '/2' }], true)).to.deep.equal([{ op: 'add', path: '/2', value: 'hi7' }]);
      expect(transformPatch(obj, [{ op: 'add', path: '/x/3/x', value: 'hi8' }], [{ op: 'add', path: '/x/5', value: 'x' }], true)).to.deep.equal([{ op: 'add', path: '/x/3/x', value: 'hi8' }]);
      expect(transformPatch(obj, [{ op: 'add', path: '/x/3/x', value: 'hi9' }], [{ op: 'add', path: '/x/0', value: 'x' }], true)).to.deep.equal([{ op: 'add', path: '/x/4/x', value: 'hi9' }]);
      expect(transformPatch(obj, [{ op: 'add', path: '/x/3/x', value: 'hi9' }], [{ op: 'add', path: '/x/3', value: 'x' }], true)).to.deep.equal([{ op: 'add', path: '/x/4/x', value: 'hi9' }]);
      expect(transformPatch(matrix, [{ op: '@changeText', path: '/1', value: [] }], [{ op: 'remove', path: '/0' }], true)).to.deep.equal([{ op: '@changeText', path: '/0', value: [] }]);
      expect(transformPatch(matrix, [{ op: '@changeText', path: '/0', value: [] }], [{ op: 'remove', path: '/1' }], true)).to.deep.equal([{ op: '@changeText', path: '/0', value: [] }]);
      expect(transformPatch(matrix, [{ op: '@changeText', path: '/0', value: [] }], [{ op: 'remove', path: '/0' }], true)).to.deep.equal([{ op: 'add', path: '/0', value: null }, { op: '@changeText', path: '/0', value: [] }]);

      expect(transformPatch(matrix, [{ op: 'remove', path: '/0' }], [{ op: 'add', path: '/0', value: 'x' }], true)).to.deep.equal([{ op: 'remove', path: '/1' }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/0', value: 'x' }], [{ op: 'remove', path: '/0' }])).to.deep.equal([{ op: 'add', path: '/0', value: 'x' }]);
    })

    it('test no-op', () => {
      expect(transformPatch(matrix, [{ op: 'remove', path: '/0' }], [{ op: 'test', path: '/0', value: 'x' }])).to.deep.equal([{ op: 'remove', path: '/0' }]);
    })

    it('converts ops on deleted elements to noops', () => {
      expect(transformPatch(matrix, [{ op: 'remove', path: '/1' }], [{ op: 'remove', path: '/1' }])).to.deep.equal([]);
      expect(transformPatch(matrix, [{ op: '@changeText', path: '/1' }], [{ op: 'remove', path: '/1' }])).to.deep.equal([{ op: 'add', path: '/1', value: null }, { op: '@changeText', path: '/1' }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/1' }], [{ op: 'remove', path: '/1' }])).to.deep.equal([{ op: 'add', path: '/1' }]);
    })

    it('converts ops on deleted elements to noops with priority', () => {
      expect(transformPatch(matrix, [{ op: 'remove', path: '/1' }], [{ op: 'remove', path: '/1' }], true)).to.deep.equal([]);
      expect(transformPatch(matrix, [{ op: '@changeText', path: '/1' }], [{ op: 'remove', path: '/1' }], true)).to.deep.equal([{ op: 'add', path: '/1', value: null }, { op: '@changeText', path: '/1' }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/1' }], [{ op: 'remove', path: '/1' }], true)).to.deep.equal([{ op: 'add', path: '/1' }]);
    })

    it('converts replace to add on deleted elements', () => {
      // Fixed behavior with replace which is the same as remove+add, so if there is a remove then it converts to an add
      expect(transformPatch(matrix, [{ op: 'replace', path: '/1', value: 'hi1' }], [{ op: 'remove', path: '/1' }])).to.deep.equal([{ op: 'add', path: '/1', value: 'hi1' }]);
    })

    it('converts replace to add on deleted elements with priority', () => {
      // Fixed behavior with replace which is the same as remove+add, so if there is a remove then it converts to an add
      expect(transformPatch(matrix, [{ op: 'replace', path: '/1', value: 'hi1' }], [{ op: 'remove', path: '/1' }], true)).to.deep.equal([{ op: 'add', path: '/1', value: 'hi1' }]);
    })

    it('converts ops on replaced elements to noops', () => {
      expect(transformPatch(matrix, [{ op: 'remove', path: '/1' }], [{ op: 'replace', path: '/1', value: 'hi1' }])).to.deep.equal([]);
      expect(transformPatch(arr, [{ op: 'add', path: '/1/x', value: 'hi' }], [{ op: 'replace', path: '/1', value: 'y' }])).to.deep.equal([]);
      expect(transformPatch(matrix, [{ op: '@changeText', path: '/1', value: [] }], [{ op: 'replace', path: '/1', value: 'y' }])).to.deep.equal([]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/0', value: 'hi' }], [{ op: 'replace', path: '/0', value: 'y' }])).to.deep.equal([{ op: 'add', path: '/0', value: 'hi' }]);
    })

    it('converts ops on replaced elements to noops with priority', () => {
      expect(transformPatch(matrix, [{ op: 'remove', path: '/1' }], [{ op: 'replace', path: '/1', value: 'hi1' }], true)).to.deep.equal([]);
      expect(transformPatch(arr, [{ op: 'add', path: '/1/x', value: 'hi' }], [{ op: 'replace', path: '/1', value: 'y' }], true)).to.deep.equal([]);
      expect(transformPatch(matrix, [{ op: '@changeText', path: '/1', value: [] }], [{ op: 'replace', path: '/1', value: 'y' }], true)).to.deep.equal([]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/0', value: 'hi' }], [{ op: 'replace', path: '/0', value: 'y' }], true)).to.deep.equal([{ op: 'add', path: '/0', value: 'hi' }]);
    })

    it('Puts the transformed op second if two inserts are simultaneous', () => {
      expect(transformPatch(matrix, [{ op: 'add', path: '/1', value: 'a' }], [{ op: 'add', path: '/1', value: 'b' }])).to.deep.equal([{ op: 'add', path: '/1', value: 'a' }]);
    })

    it('Puts the transformed op first if two inserts are simultaneous with priority', () => {
      expect(transformPatch(matrix, [{ op: 'add', path: '/1', value: 'a' }], [{ op: 'add', path: '/1', value: 'b' }], true)).to.deep.equal([{ op: 'add', path: '/2', value: 'a' }]);
    })

    it('converts an attempt to re-delete a list element into a no-op', () => {
      expect(transformPatch(matrix, [{ op: 'remove', path: '/1' }], [{ op: 'remove', path: '/1' }])).to.deep.equal([]);
    })

    it('moves ops on a moved element with the element', () => {
      expect(transformPatch(matrix, [{ op: 'remove', path: '/4' }], [{ op: 'move', from: '/4', path: '/10' }])).to.deep.equal([{ op: 'remove', path: '/10' }]);
      expect(transformPatch(matrix, [{ op: 'replace', path: '/4', value: 'a' }], [{ op: 'move', from: '/4', path: '/10' }])).to.deep.equal([{ op: 'replace', path: '/10', value: 'a' }]);
      expect(transformPatch(matrix, [{ op: '@changeText', path: '/4', value: [] }], [{ op: 'move', from: '/4', path: '/10' }])).to.deep.equal([{ op: '@changeText', path: '/10', value: [] }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/4/1', value: 'a' }], [{ op: 'move', from: '/4', path: '/10' }])).to.deep.equal([{ op: 'add', path: '/10/1', value: 'a' }]);
      expect(transformPatch(matrix, [{ op: 'replace', path: '/4/1', value: 'a' }], [{ op: 'move', from: '/4', path: '/10' }])).to.deep.equal([{ op: 'replace', path: '/10/1', value: 'a' }]);

      expect(transformPatch(matrix, [{ op: 'add', path: '/0', value: null }], [{ op: 'move', from: '/0', path: '/1' }])).to.deep.equal([{ op: 'add', path: '/0', value: null }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/5', value: 'x' }], [{ op: 'move', from: '/5', path: '/1' }])).to.deep.equal([{ op: 'add', path: '/6', value: 'x' }]);
      expect(transformPatch(matrix, [{ op: 'remove', path: '/5' }], [{ op: 'move', from: '/5', path: '/1' }])).to.deep.equal([{ op: 'remove', path: '/1' }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/0', value: {} }], [{ op: 'move', from: '/0', path: '/0' }])).to.deep.equal([{ op: 'add', path: '/0', value: {} }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/0', value: [] }], [{ op: 'move', from: '/1', path: '/0' }])).to.deep.equal([{ op: 'add', path: '/0', value: [] }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/2', value: 'x' }], [{ op: 'move', from: '/0', path: '/1' }])).to.deep.equal([{ op: 'add', path: '/2', value: 'x' }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/5', value: 'x' }], [{ op: 'move', from: '/10', path: '/1' }])).to.deep.equal([{ op: 'add', path: '/6', value: 'x' }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/1', value: 'x' }], [{ op: 'move', from: '/1', path: '/10' }])).to.deep.equal([{ op: 'add', path: '/1', value: 'x' }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/2', value: 'x' }], [{ op: 'move', from: '/1', path: '/10' }])).to.deep.equal([{ op: 'add', path: '/1', value: 'x' }]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/3', path: '/5' }], [{ op: 'move', from: '/0', path: '/10' }])).to.deep.equal([{ op: 'move', from: '/2', path: '/4' }]);
    })

    it('moves ops on a moved element with the element with priority', () => {
      expect(transformPatch(matrix, [{ op: 'remove', path: '/4' }], [{ op: 'move', from: '/4', path: '/10' }], true)).to.deep.equal([{ op: 'remove', path: '/10' }]);
      expect(transformPatch(matrix, [{ op: 'replace', path: '/4', value: 'a' }], [{ op: 'move', from: '/4', path: '/10' }], true)).to.deep.equal([{ op: 'replace', path: '/10', value: 'a' }]);
      expect(transformPatch(matrix, [{ op: '@changeText', path: '/4', value: [] }], [{ op: 'move', from: '/4', path: '/10' }], true)).to.deep.equal([{ op: '@changeText', path: '/10', value: [] }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/4/1', value: 'a' }], [{ op: 'move', from: '/4', path: '/10' }], true)).to.deep.equal([{ op: 'add', path: '/10/1', value: 'a' }]);
      expect(transformPatch(matrix, [{ op: 'replace', path: '/4/1', value: 'a' }], [{ op: 'move', from: '/4', path: '/10' }], true)).to.deep.equal([{ op: 'replace', path: '/10/1', value: 'a' }]);

      expect(transformPatch(matrix, [{ op: 'add', path: '/0', value: null }], [{ op: 'move', from: '/0', path: '/1' }], true)).to.deep.equal([{ op: 'add', path: '/0', value: null }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/5', value: 'x' }], [{ op: 'move', from: '/5', path: '/1' }], true)).to.deep.equal([{ op: 'add', path: '/6', value: 'x' }]);
      expect(transformPatch(matrix, [{ op: 'remove', path: '/5' }], [{ op: 'move', from: '/5', path: '/1' }], true)).to.deep.equal([{ op: 'remove', path: '/1' }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/0', value: {} }], [{ op: 'move', from: '/0', path: '/0' }], true)).to.deep.equal([{ op: 'add', path: '/0', value: {} }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/0', value: [] }], [{ op: 'move', from: '/1', path: '/0' }], true)).to.deep.equal([{ op: 'add', path: '/0', value: [] }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/2', value: 'x' }], [{ op: 'move', from: '/0', path: '/1' }], true)).to.deep.equal([{ op: 'add', path: '/2', value: 'x' }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/5', value: 'x' }], [{ op: 'move', from: '/10', path: '/1' }], true)).to.deep.equal([{ op: 'add', path: '/6', value: 'x' }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/1', value: 'x' }], [{ op: 'move', from: '/1', path: '/10' }], true)).to.deep.equal([{ op: 'add', path: '/1', value: 'x' }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/2', value: 'x' }], [{ op: 'move', from: '/1', path: '/10' }], true)).to.deep.equal([{ op: 'add', path: '/1', value: 'x' }]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/3', path: '/5' }], [{ op: 'move', from: '/0', path: '/10' }], true)).to.deep.equal([{ op: 'move', from: '/2', path: '/4' }]);
    })

    it('moves target index on remove/add', () => {
      expect(transformPatch(matrix, [{ op: 'move', from: '/0', path: '/2' }], [{ op: 'remove', path: '/1', value: 'x' }])).to.deep.equal([{ op: 'move', from: '/0', path: '/1' }]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/2', path: '/4' }], [{ op: 'remove', path: '/1', value: 'x' }])).to.deep.equal([{ op: 'move', from: '/1', path: '/3' }]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/0', path: '/2' }], [{ op: 'add', path: '/1', value: 'x' }])).to.deep.equal([{ op: 'move', from: '/0', path: '/3' }]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/2', path: '/4' }], [{ op: 'add', path: '/1', value: 'x' }])).to.deep.equal([{ op: 'move', from: '/3', path: '/5' }]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/0', path: '/0' }], [{ op: 'add', path: '/0', value: 28 }])).to.deep.equal([]);
    })

    it('moves target index on remove/add with priority', () => {
      expect(transformPatch(matrix, [{ op: 'move', from: '/0', path: '/2' }], [{ op: 'remove', path: '/1', value: 'x' }], true)).to.deep.equal([{ op: 'move', from: '/0', path: '/1' }]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/2', path: '/4' }], [{ op: 'remove', path: '/1', value: 'x' }], true)).to.deep.equal([{ op: 'move', from: '/1', path: '/3' }]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/0', path: '/2' }], [{ op: 'add', path: '/1', value: 'x' }], true)).to.deep.equal([{ op: 'move', from: '/0', path: '/3' }]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/2', path: '/4' }], [{ op: 'add', path: '/1', value: 'x' }], true)).to.deep.equal([{ op: 'move', from: '/3', path: '/5' }]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/0', path: '/0' }], [{ op: 'add', path: '/0', value: 28 }], true)).to.deep.equal([]);
    })

    it('tiebreaks move vs. add/delete', () => {
      expect(transformPatch(matrix, [{ op: 'move', from: '/0', path: '/2' }], [{ op: 'remove', path: '/0' }])).to.deep.equal([]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/0', path: '/2' }], [{ op: 'add', path: '/0', value: 'x' }])).to.deep.equal([{ op: 'move', from: '/1', path: '/3' }]);
    })

    it('tiebreaks move vs. add/delete with priority', () => {
      expect(transformPatch(matrix, [{ op: 'move', from: '/0', path: '/2' }], [{ op: 'remove', path: '/0' }], true)).to.deep.equal([]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/0', path: '/2' }], [{ op: 'add', path: '/0', value: 'x' }], true)).to.deep.equal([{ op: 'move', from: '/1', path: '/3' }]);
    })

    it('replacement vs. deletion', () => {
      expect(transformPatch(matrix, [{ op: 'replace', path: '/0', value: 'y' }], [{ op: 'remove', path: '/0' }])).to.deep.equal([{ op: 'add', path: '/0', value: 'y' }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/0', value: 'y' }], [{ op: 'remove', path: '/0' }])).to.deep.equal([{ op: 'add', path: '/0', value: 'y' }]);
    })

    it('replacement vs. deletion with priority', () => {
      expect(transformPatch(matrix, [{ op: 'replace', path: '/0', value: 'y' }], [{ op: 'remove', path: '/0' }], true)).to.deep.equal([{ op: 'add', path: '/0', value: 'y' }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/0', value: 'y' }], [{ op: 'remove', path: '/0' }], true)).to.deep.equal([{ op: 'add', path: '/0', value: 'y' }]);
    })

    it('replacement vs. insertion', () => {
      expect(transformPatch(matrix, [{ op: 'replace', path: '/0', value: 'y' }], [{ op: 'add', path: '/0', value: 'x' }])).to.deep.equal([{ op: 'replace', path: '/1', value: 'y' }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/5', value: 'y' }], [{ op: 'replace', path: '/0', value: 'x' }])).to.deep.equal([{ op: 'add', path: '/5', value: 'y' }]);
    })

    it('replacement vs. insertion with priority', () => {
      expect(transformPatch(matrix, [{ op: 'replace', path: '/0', value: 'y' }], [{ op: 'add', path: '/0', value: 'x' }], true)).to.deep.equal([{ op: 'replace', path: '/1', value: 'y' }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/5', value: 'y' }], [{ op: 'replace', path: '/0', value: 'x' }], true)).to.deep.equal([{ op: 'add', path: '/5', value: 'y' }]);
    })

    it('replacement vs. replacement', () => {
      expect(transformPatch(matrix, [{ op: 'replace', path: '/0', value: 'y' }], [{ op: 'replace', path: '/0', value: 'x' }])).to.deep.equal([{ op: 'replace', path: '/0', value: 'y' }]);
    })

    it('replacement vs. replacement with priority', () => {
      expect(transformPatch(matrix, [{ op: 'replace', path: '/0', value: 'y' }], [{ op: 'replace', path: '/0', value: 'x' }], true)).to.deep.equal([]);
    })

    it.only('move vs. move', () => {
      expect(transformPatch(matrix, [{ op: 'move', from: '/0', path: '/2' }], [{ op: 'move', from: '/2', path: '/1' }])).to.deep.equal([{ op: 'move', from: '/0', path: '/2' }]);
      // expect(transformPatch(matrix, [{ op: 'move', from: '/3', path: '/3' }], [{ op: 'move', from: '/5', path: '/0' }])).to.deep.equal([]);
      // expect(transformPatch(matrix, [{ op: 'move', from: '/2', path: '/0' }], [{ op: 'move', from: '/1', path: '/0' }])).to.deep.equal([{ op: 'move', from: '/2', path: '/0' }]);
      // expect(transformPatch(matrix, [{ op: 'move', from: '/2', path: '/0' }], [{ op: 'move', from: '/5', path: '/0' }])).to.deep.equal([{ op: 'move', from: '/3', path: '/0' }]);
      // expect(transformPatch(matrix, [{ op: 'move', from: '/2', path: '/5' }], [{ op: 'move', from: '/2', path: '/0' }])).to.deep.equal([{ op: 'move', from: '/0', path: '/5' }]);
      // expect(transformPatch(matrix, [{ op: 'move', from: '/0', path: '/1' }], [{ op: 'move', from: '/1', path: '/0' }])).to.deep.equal([]);
      // expect(transformPatch(matrix, [{ op: 'move', from: '/3', path: '/1' }], [{ op: 'move', from: '/1', path: '/3' }])).to.deep.equal([{ op: 'move', from: '/2', path: '/1' }]);
      // expect(transformPatch(matrix, [{ op: 'move', from: '/1', path: '/3' }], [{ op: 'move', from: '/3', path: '/1' }])).to.deep.equal([{ op: 'move', from: '/2', path: '/3' }]);
      // expect(transformPatch(matrix, [{ op: 'move', from: '/2', path: '/6' }], [{ op: 'move', from: '/0', path: '/1' }])).to.deep.equal([{ op: 'move', from: '/2', path: '/6' }]);
      // expect(transformPatch(matrix, [{ op: 'move', from: '/2', path: '/6' }], [{ op: 'move', from: '/1', path: '/0' }])).to.deep.equal([{ op: 'move', from: '/2', path: '/6' }]);
      // expect(transformPatch(matrix, [{ op: 'move', from: '/0', path: '/1' }], [{ op: 'move', from: '/2', path: '/1' }])).to.deep.equal([{ op: 'move', from: '/0', path: '/1' }]);
      // expect(transformPatch(matrix, [{ op: 'move', from: '/0', path: '/0' }], [{ op: 'move', from: '/1', path: '/0' }])).to.deep.equal([]);
      // expect(transformPatch(matrix, [{ op: 'move', from: '/0', path: '/1' }], [{ op: 'move', from: '/1', path: '/3' }])).to.deep.equal([{ op: 'move', from: '/0', path: '/1' }]);
      // expect(transformPatch(matrix, [{ op: 'move', from: '/2', path: '/1' }], [{ op: 'move', from: '/3', path: '/2' }])).to.deep.equal([{ op: 'move', from: '/3', path: '/1' }]);
      // expect(transformPatch(matrix, [{ op: 'move', from: '/3', path: '/2' }], [{ op: 'move', from: '/2', path: '/1' }])).to.deep.equal([{ op: 'move', from: '/3', path: '/2' }]);
    })

    it('move vs. move with priority', () => {
      expect(transformPatch(matrix, [{ op: 'move', from: '/0', path: '/2' }], [{ op: 'move', from: '/2', path: '/1' }], true)).to.deep.equal([{ op: 'move', from: '/0', path: '/2' }]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/3', path: '/3' }], [{ op: 'move', from: '/5', path: '/0' }], true)).to.deep.equal([]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/2', path: '/0' }], [{ op: 'move', from: '/1', path: '/0' }], true)).to.deep.equal([{ op: 'move', from: '/2', path: '/0' }]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/2', path: '/0' }], [{ op: 'move', from: '/5', path: '/0' }], true)).to.deep.equal([{ op: 'move', from: '/3', path: '/0' }]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/2', path: '/5' }], [{ op: 'move', from: '/2', path: '/0' }], true)).to.deep.equal([{ op: 'move', from: '/0', path: '/5' }]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/0', path: '/1' }], [{ op: 'move', from: '/1', path: '/0' }], true)).to.deep.equal([]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/3', path: '/1' }], [{ op: 'move', from: '/1', path: '/3' }], true)).to.deep.equal([{ op: 'move', from: '/2', path: '/1' }]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/1', path: '/3' }], [{ op: 'move', from: '/3', path: '/1' }], true)).to.deep.equal([{ op: 'move', from: '/2', path: '/3' }]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/2', path: '/6' }], [{ op: 'move', from: '/0', path: '/1' }], true)).to.deep.equal([{ op: 'move', from: '/2', path: '/6' }]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/2', path: '/6' }], [{ op: 'move', from: '/1', path: '/0' }], true)).to.deep.equal([{ op: 'move', from: '/2', path: '/6' }]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/0', path: '/1' }], [{ op: 'move', from: '/2', path: '/1' }], true)).to.deep.equal([{ op: 'move', from: '/0', path: '/1' }]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/0', path: '/0' }], [{ op: 'move', from: '/1', path: '/0' }], true)).to.deep.equal([]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/0', path: '/1' }], [{ op: 'move', from: '/1', path: '/3' }], true)).to.deep.equal([{ op: 'move', from: '/0', path: '/1' }]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/2', path: '/1' }], [{ op: 'move', from: '/3', path: '/2' }], true)).to.deep.equal([{ op: 'move', from: '/3', path: '/1' }]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/3', path: '/2' }], [{ op: 'move', from: '/2', path: '/1' }], true)).to.deep.equal([{ op: 'move', from: '/3', path: '/2' }]);
    })

    it('changes indices correctly around a move', () => {
      expect(transformPatch(matrix, [{ op: 'add', path: '/0/0', value: {} }], [{ op: 'move', from: '/1', path: '/0' }])).to.deep.equal([{ op: 'add', path: '/1/0', value: {} }]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/1', path: '/0' }], [{ op: 'remove', path: '/0' }])).to.deep.equal([]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/0', path: '/1' }], [{ op: 'remove', path: '/1' }])).to.deep.equal([{ op: 'move', from: '/0', path: '/1' }]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/6', path: '/0' }], [{ op: 'remove', path: '/2' }])).to.deep.equal([{ op: 'move', from: '/5', path: '/0' }]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/1', path: '/0' }], [{ op: 'remove', path: '/2' }])).to.deep.equal([{ op: 'move', from: '/1', path: '/0' }]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/2', path: '/1' }], [{ op: 'remove', path: '/1' }])).to.deep.equal([]);

      expect(transformPatch(matrix, [{ op: 'remove', path: '/2' }], [{ op: 'move', from: '/1', path: '/2' }])).to.deep.equal([{ op: 'remove', path: '/1' }]);
      expect(transformPatch(matrix, [{ op: 'remove', path: '/1' }], [{ op: 'move', from: '/2', path: '/1' }])).to.deep.equal([{ op: 'remove', path: '/2' }]);


      expect(transformPatch(matrix, [{ op: 'remove', path: '/1' }], [{ op: 'move', from: '/0', path: '/1' }])).to.deep.equal([{ op: 'remove', path: '/0' }]);

      expect(transformPatch(matrix, [{ op: 'replace', path: '/1', value: 2 }], [{ op: 'move', from: '/1', path: '/0' }])).to.deep.equal([{ op: 'replace', path: '/0', value: 2 }]);
      expect(transformPatch(matrix, [{ op: 'replace', path: '/1', value: 3 }], [{ op: 'move', from: '/0', path: '/1' }])).to.deep.equal([{ op: 'replace', path: '/0', value: 3 }]);
      expect(transformPatch(matrix, [{ op: 'replace', path: '/0', value: 4 }], [{ op: 'move', from: '/1', path: '/0' }])).to.deep.equal([{ op: 'replace', path: '/1', value: 4 }]);
    })

    it('changes indices correctly around a move with priority', () => {
      expect(transformPatch(matrix, [{ op: 'add', path: '/0/0', value: {} }], [{ op: 'move', from: '/1', path: '/0' }], true)).to.deep.equal([{ op: 'add', path: '/1/0', value: {} }]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/1', path: '/0' }], [{ op: 'remove', path: '/0' }], true)).to.deep.equal([]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/0', path: '/1' }], [{ op: 'remove', path: '/1' }], true)).to.deep.equal([{ op: 'move', from: '/0', path: '/1' }]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/6', path: '/0' }], [{ op: 'remove', path: '/2' }], true)).to.deep.equal([{ op: 'move', from: '/5', path: '/0' }]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/1', path: '/0' }], [{ op: 'remove', path: '/2' }], true)).to.deep.equal([{ op: 'move', from: '/1', path: '/0' }]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/2', path: '/1' }], [{ op: 'remove', path: '/1' }], true)).to.deep.equal([]);

      expect(transformPatch(matrix, [{ op: 'remove', path: '/2' }], [{ op: 'move', from: '/1', path: '/2' }], true)).to.deep.equal([{ op: 'remove', path: '/1' }]);
      expect(transformPatch(matrix, [{ op: 'remove', path: '/1' }], [{ op: 'move', from: '/2', path: '/1' }], true)).to.deep.equal([{ op: 'remove', path: '/2' }]);


      expect(transformPatch(matrix, [{ op: 'remove', path: '/1' }], [{ op: 'move', from: '/0', path: '/1' }], true)).to.deep.equal([{ op: 'remove', path: '/0' }]);

      expect(transformPatch(matrix, [{ op: 'replace', path: '/1', value: 2 }], [{ op: 'move', from: '/1', path: '/0' }], true)).to.deep.equal([{ op: 'replace', path: '/0', value: 2 }]);
      expect(transformPatch(matrix, [{ op: 'replace', path: '/1', value: 3 }], [{ op: 'move', from: '/0', path: '/1' }], true)).to.deep.equal([{ op: 'replace', path: '/0', value: 3 }]);
      expect(transformPatch(matrix, [{ op: 'replace', path: '/0', value: 4 }], [{ op: 'move', from: '/1', path: '/0' }], true)).to.deep.equal([{ op: 'replace', path:'/1', value: 4 }]);
    })

    it('changes indices correctly around a move from a non-list', () => {
      expect(transformPatch(matrix, [{ op: 'add', path: '/0/0', value: {} }], [{ op: 'move', from: '/x', path: '/0' }])).to.deep.equal([{ op: 'add', path: '/1/0', value: {} }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/0', value: {} }], [{ op: 'move', from: '/x', path: '/0' }])).to.deep.equal([{ op: 'add', path: '/1', value: {} }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/0', value: {} }], [{ op: 'move', from: '/0', path: '/x' }])).to.deep.equal([{ op: 'add', path: '/0', value: {} }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/3', value: {} }], [{ op: 'move', from: '/x', path: '/1' }])).to.deep.equal([{ op: 'add', path: '/4', value: {} }]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/1', path: '/3' }], [{ op: 'move', from: '/x', path: '/1' }])).to.deep.equal([{ op: 'move', from: '/2', path: '/4' }]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/1', path: '/3' }], [{ op: 'move', from: '/1', path: '/x' }])).to.deep.equal([{ op: 'move', from: '/x', path: '/2' }]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/3', path: '/1' }], [{ op: 'move', from: '/2', path: '/x' }])).to.deep.equal([{ op: 'move', from: '/2', path: '/1' }]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/3', path: '/1' }], [{ op: 'move', from: '/x', path: '/2' }])).to.deep.equal([{ op: 'move', from: '/4', path: '/1' }]);
    })

    it('changes indices correctly around a move from a non-list with priority', () => {
      expect(transformPatch(matrix, [{ op: 'add', path: '/0/0', value: {} }], [{ op: 'move', from: '/x', path: '/0' }], true)).to.deep.equal([{ op: 'add', path: '/1/0', value: {} }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/0', value: {} }], [{ op: 'move', from: '/x', path: '/0' }], true)).to.deep.equal([{ op: 'add', path: '/0', value: {} }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/0', value: {} }], [{ op: 'move', from: '/0', path: '/x' }], true)).to.deep.equal([{ op: 'add', path: '/0', value: {} }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/3', value: {} }], [{ op: 'move', from: '/x', path: '/1' }], true)).to.deep.equal([{ op: 'add', path: '/4', value: {} }]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/1', path: '/3' }], [{ op: 'move', from: '/x', path: '/1' }], true)).to.deep.equal([{ op: 'move', from: '/2', path: '/4' }]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/1', path: '/3' }], [{ op: 'move', from: '/1', path: '/x' }], true)).to.deep.equal([{ op: 'move', from: '/x', path: '/2' }]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/3', path: '/1' }], [{ op: 'move', from: '/2', path: '/x' }], true)).to.deep.equal([{ op: 'move', from: '/2', path: '/1' }]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/3', path: '/1' }], [{ op: 'move', from: '/x', path: '/2' }], true)).to.deep.equal([{ op: 'move', from: '/4', path: '/1' }]);
    })

    it('add vs. move', () => {
      expect(transformPatch(matrix, [{ op: 'add', path: '/0', value: [] }], [{ op: 'move', from: '/1', path: '/3' }])).to.deep.equal([{ op: 'add', path: '/0', value: [] }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/1', value: [] }], [{ op: 'move', from: '/1', path: '/3' }])).to.deep.equal([{ op: 'add', path: '/1', value: [] }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/2', value: [] }], [{ op: 'move', from: '/1', path: '/3' }])).to.deep.equal([{ op: 'add', path: '/1', value: [] }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/3', value: [] }], [{ op: 'move', from: '/1', path: '/3' }])).to.deep.equal([{ op: 'add', path: '/3', value: [] }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/4', value: [] }], [{ op: 'move', from: '/1', path: '/3' }])).to.deep.equal([{ op: 'add', path: '/4', value: [] }]);

      expect(transformPatch(matrix, [{ op: 'move', from: '/1', path: '/3' }], [{ op: 'add', path: '/0', value: [] }])).to.deep.equal([{ op: 'move', from: '/2', path: '/4' }]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/1', path: '/3' }], [{ op: 'add', path: '/1', value: [] }])).to.deep.equal([{ op: 'move', from: '/2', path: '/4' }]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/1', path: '/3' }], [{ op: 'add', path: '/2', value: [] }])).to.deep.equal([{ op: 'move', from: '/1', path: '/4' }]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/1', path: '/3' }], [{ op: 'add', path: '/3', value: [] }])).to.deep.equal([{ op: 'move', from: '/1', path: '/4' }]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/1', path: '/3' }], [{ op: 'add', path: '/4', value: [] }])).to.deep.equal([{ op: 'move', from: '/1', path: '/3' }]);

      expect(transformPatch(matrix, [{ op: 'add', path: '/0', value: [] }], [{ op: 'move', from: '/1', path: '/2' }])).to.deep.equal([{ op: 'add', path: '/0', value: [] }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/1', value: [] }], [{ op: 'move', from: '/1', path: '/2' }])).to.deep.equal([{ op: 'add', path: '/1', value: [] }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/2', value: [] }], [{ op: 'move', from: '/1', path: '/2' }])).to.deep.equal([{ op: 'add', path: '/2', value: [] }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/3', value: [] }], [{ op: 'move', from: '/1', path: '/2' }])).to.deep.equal([{ op: 'add', path: '/3', value: [] }]);

      expect(transformPatch(matrix, [{ op: 'add', path: '/0', value: [] }], [{ op: 'move', from: '/3', path: '/1' }])).to.deep.equal([{ op: 'add', path: '/0', value: [] }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/1', value: [] }], [{ op: 'move', from: '/3', path: '/1' }])).to.deep.equal([{ op: 'add', path: '/1', value: [] }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/2', value: [] }], [{ op: 'move', from: '/3', path: '/1' }])).to.deep.equal([{ op: 'add', path: '/3', value: [] }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/3', value: [] }], [{ op: 'move', from: '/3', path: '/1' }])).to.deep.equal([{ op: 'add', path: '/3', value: [] }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/4', value: [] }], [{ op: 'move', from: '/3', path: '/1' }])).to.deep.equal([{ op: 'add', path: '/4', value: [] }]);

      expect(transformPatch(matrix, [{ op: 'move', from: '/3', path: '/1' }], [{ op: 'add', path: '/0', value: [] }])).to.deep.equal([{ op: 'move', from: '/4', path: '/2' }]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/3', path: '/1' }], [{ op: 'add', path: '/1', value: [] }])).to.deep.equal([{ op: 'move', from: '/4', path: '/2' }]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/3', path: '/1' }], [{ op: 'add', path: '/2', value: [] }])).to.deep.equal([{ op: 'move', from: '/4', path: '/1' }]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/3', path: '/1' }], [{ op: 'add', path: '/3', value: [] }])).to.deep.equal([{ op: 'move', from: '/4', path: '/1' }]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/3', path: '/1' }], [{ op: 'add', path: '/4', value: [] }])).to.deep.equal([{ op: 'move', from: '/3', path: '/1' }]);

      expect(transformPatch(matrix, [{ op: 'add', path: '/0', value: [] }], [{ op: 'move', from: '/2', path: '/1' }])).to.deep.equal([{ op: 'add', path: '/0', value: [] }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/1', value: [] }], [{ op: 'move', from: '/2', path: '/1' }])).to.deep.equal([{ op: 'add', path: '/1', value: [] }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/2', value: [] }], [{ op: 'move', from: '/2', path: '/1' }])).to.deep.equal([{ op: 'add', path: '/2', value: [] }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/3', value: [] }], [{ op: 'move', from: '/2', path: '/1' }])).to.deep.equal([{ op: 'add', path: '/3', value: [] }]);
    })

    it('add vs. move with priority', () => {
      expect(transformPatch(matrix, [{ op: 'add', path: '/0', value: [] }], [{ op: 'move', from: '/1', path: '/3' }], true)).to.deep.equal([{ op: 'add', path: '/0', value: [] }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/1', value: [] }], [{ op: 'move', from: '/1', path: '/3' }], true)).to.deep.equal([{ op: 'add', path: '/1', value: [] }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/2', value: [] }], [{ op: 'move', from: '/1', path: '/3' }], true)).to.deep.equal([{ op: 'add', path: '/1', value: [] }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/3', value: [] }], [{ op: 'move', from: '/1', path: '/3' }], true)).to.deep.equal([{ op: 'add', path: '/3', value: [] }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/4', value: [] }], [{ op: 'move', from: '/1', path: '/3' }], true)).to.deep.equal([{ op: 'add', path: '/4', value: [] }]);

      expect(transformPatch(matrix, [{ op: 'move', from: '/1', path: '/3' }], [{ op: 'add', path: '/0', value: [] }], true)).to.deep.equal([{ op: 'move', from: '/2', path: '/4' }]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/1', path: '/3' }], [{ op: 'add', path: '/1', value: [] }], true)).to.deep.equal([{ op: 'move', from: '/2', path: '/4' }]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/1', path: '/3' }], [{ op: 'add', path: '/2', value: [] }], true)).to.deep.equal([{ op: 'move', from: '/1', path: '/4' }]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/1', path: '/3' }], [{ op: 'add', path: '/3', value: [] }], true)).to.deep.equal([{ op: 'move', from: '/1', path: '/3' }]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/1', path: '/3' }], [{ op: 'add', path: '/4', value: [] }], true)).to.deep.equal([{ op: 'move', from: '/1', path: '/3' }]);

      expect(transformPatch(matrix, [{ op: 'add', path: '/0', value: [] }], [{ op: 'move', from: '/1', path: '/2' }], true)).to.deep.equal([{ op: 'add', path: '/0', value: [] }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/1', value: [] }], [{ op: 'move', from: '/1', path: '/2' }], true)).to.deep.equal([{ op: 'add', path: '/1', value: [] }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/2', value: [] }], [{ op: 'move', from: '/1', path: '/2' }], true)).to.deep.equal([{ op: 'add', path: '/2', value: [] }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/3', value: [] }], [{ op: 'move', from: '/1', path: '/2' }], true)).to.deep.equal([{ op: 'add', path: '/3', value: [] }]);

      expect(transformPatch(matrix, [{ op: 'add', path: '/0', value: [] }], [{ op: 'move', from: '/3', path: '/1' }], true)).to.deep.equal([{ op: 'add', path: '/0', value: [] }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/1', value: [] }], [{ op: 'move', from: '/3', path: '/1' }], true)).to.deep.equal([{ op: 'add', path: '/1', value: [] }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/2', value: [] }], [{ op: 'move', from: '/3', path: '/1' }], true)).to.deep.equal([{ op: 'add', path: '/3', value: [] }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/3', value: [] }], [{ op: 'move', from: '/3', path: '/1' }], true)).to.deep.equal([{ op: 'add', path: '/3', value: [] }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/4', value: [] }], [{ op: 'move', from: '/3', path: '/1' }], true)).to.deep.equal([{ op: 'add', path: '/4', value: [] }]);

      expect(transformPatch(matrix, [{ op: 'move', from: '/3', path: '/1' }], [{ op: 'add', path: '/0', value: [] }], true)).to.deep.equal([{ op: 'move', from: '/4', path: '/2' }]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/3', path: '/1' }], [{ op: 'add', path: '/1', value: [] }], true)).to.deep.equal([{ op: 'move', from: '/4', path: '/1' }]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/3', path: '/1' }], [{ op: 'add', path: '/2', value: [] }], true)).to.deep.equal([{ op: 'move', from: '/4', path: '/1' }]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/3', path: '/1' }], [{ op: 'add', path: '/3', value: [] }], true)).to.deep.equal([{ op: 'move', from: '/4', path: '/1' }]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/3', path: '/1' }], [{ op: 'add', path: '/4', value: [] }], true)).to.deep.equal([{ op: 'move', from: '/3', path: '/1' }]);

      expect(transformPatch(matrix, [{ op: 'add', path: '/0', value: [] }], [{ op: 'move', from: '/2', path: '/1' }], true)).to.deep.equal([{ op: 'add', path: '/0', value: [] }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/1', value: [] }], [{ op: 'move', from: '/2', path: '/1' }], true)).to.deep.equal([{ op: 'add', path: '/1', value: [] }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/2', value: [] }], [{ op: 'move', from: '/2', path: '/1' }], true)).to.deep.equal([{ op: 'add', path: '/2', value: [] }]);
      expect(transformPatch(matrix, [{ op: 'add', path: '/3', value: [] }], [{ op: 'move', from: '/2', path: '/1' }], true)).to.deep.equal([{ op: 'add', path: '/3', value: [] }]);
    })

  })

  describe('object', () => {

    it('Ops on deleted elements become noops', () => {
      expect(transformPatch(matrix, [{ op: 'add', path: '/1/0', value: 'hi' }], [{ op: 'remove', path: '/1' }])).to.deep.equal([]);
      expect(transformPatch(arr, [{ op: '@changeText', path: '/1/text' }], [{ op: 'remove', path: '/1' }])).to.deep.equal([]);
    })

    it('Ops on replaced elements become noops', () => {
      expect(transformPatch(matrix, [{ op: 'add', path: '/1/0', value: 'hi' }], [{ op: 'replace', path: '/1', value: 'y' }])).to.deep.equal([]);
      expect(transformPatch(arr, [{ op: '@changeText', path: '/1/text' }], [{ op: 'replace', path: '/1', value: 'y' }])).to.deep.equal([]);
    })

    it('If two inserts are simultaneous, the lefts insert will win', () => {
      expect(transformPatch(obj, [{ op: 'add', path: '/x', value: 'a' }], [{ op: 'add', path: '/x', value: 'b' }])).to.deep.equal([{ op: 'add', path: '/x', value: 'a' }]);
      expect(transformPatch(obj, [{ op: 'replace', path: '/x', value: 'a' }], [{ op: 'add', path: '/x', value: 'b' }])).to.deep.equal([{ op: 'replace', path: '/x', value: 'a' }]);
    })

    // it('If two inserts are simultaneous, the right inserts will win with priority', () => {
    //   expect(transformPatch(obj, [{ op: 'add', path: '/x', value: 'a' }], [{ op: 'add', path: '/x', value: 'b' }], true)).to.deep.equal([{ op: 'add', path: '/x', value: 'b' }]);
    //   expect(transformPatch(obj, [{ op: 'replace', path: '/x', value: 'a' }], [{ op: 'add', path: '/x', value: 'b' }], true)).to.deep.equal([{ op: 'add', path: '/x', value: 'b' }]);
    // })

    it('parallel ops on different keys miss each other', () => {
      expect(transformPatch(obj, [{ op: 'add', path: '/a', value: 'x' }], [{ op: 'add', path: '/b', value: 'z' }])).to.deep.equal([{ op: 'add', path: '/a', value: 'x' }]);
      expect(transformPatch(obj, [{ op: 'add', path: '/a', value: 'x' }], [{ op: 'remove', path: '/b' }])).to.deep.equal([{ op: 'add', path: '/a', value: 'x' }]);
      expect(transformPatch(obj, [{ op: 'add', path: '/in/he', value: {} }], [{ op: 'remove', path: '/and' }])).to.deep.equal([{ op: 'add', path: '/in/he', value: {} }]);
      expect(transformPatch(obj, [{ op: 'add', path: '/x/0', value: 'his ' }], [{ op: 'replace', path: '/y', value: 1 }])).to.deep.equal([{ op: 'add', path: '/x/0', value: 'his ' }]);
      expect(transformPatch(obj, [{ op: '@changeText', path: '/x' }], [{ op: 'replace', path: '/y', value: 1 }])).to.deep.equal([{ op: '@changeText', path: '/x' }]);
    })

    it('replacement vs. deletion', () => {
      expect(transformPatch(obj, [{ op: 'add', path: '/', value: {} }], [{ op: 'remove', path: '/' }])).to.deep.equal([{ op: 'add', path: '/', value: {} }]);
      expect(transformPatch(obj, [{ op: 'replace', path: '/', value: {} }], [{ op: 'remove', path: '/' }])).to.deep.equal([{ op: 'replace', path: '/', value: {} }]);
    })

    it('replacement vs. replacement', () => {
      expect(transformPatch(obj, [{ op: 'remove', path: '/' }, { op: 'replace', path: '/', value: {} }], [{ op: 'remove', path: '/' }, { op: 'add', path: '/', value: null }])).to.deep.equal([{ op: 'replace', path: '/', value: {} }]);
      expect(transformPatch(obj, [{ op: 'remove', path: '/' }, { op: 'add', path: '/', value: {} }], [{ op: 'remove', path: '/' }, { op: 'add', path: '/', value: null }])).to.deep.equal([{ op: 'add', path: '/', value: {} }]);
      expect(transformPatch(obj, [{ op: 'replace', path: '/', value: {} }], [{ op: 'replace', path: '/', value: null }])).to.deep.equal([{ op: 'replace', path: '/', value: {} }]);
    })

    it('move, remove', () => {
      expect(transformPatch(obj, [{ op: 'add', path: '/x', value: true }], [{ op: 'move', from: '/x', path: '/y' }])).to.deep.equal([{ op: 'add', path: '/y', value: true }]);
      expect(transformPatch(obj, [{ op: 'remove', path: '/x' }, { op: 'add', path: '/x', value: true }], [{ op: 'move', from: '/x', path: '/y' }])).to.deep.equal([{ op: 'remove', path: '/y' }, { op: 'add', path: '/x', value: true }]);
      expect(transformPatch(obj, [{ op: 'move', from: '/x/a', path: '/x/b' }], [{ op: 'move', from: '/x', path: '/y' }, { op: 'move', from: '/y', path: '/z' }])).to.deep.equal([{ op: 'move', from: '/z/a', path: '/z/b' }]);
    })

    it('copy', () => {
      expect(transformPatch(obj, [{ op: 'add', path: '/x/y', value: true }], [{ op: 'copy', from: '/y', path: '/x' }])).to.deep.equal([]);
    })


    it('An attempt to re-delete a key becomes a no-op', () => {
      expect(transformPatch(obj, [{ op: 'remove', path: '/k' }], [{ op: 'remove', path: '/k' }])).to.deep.equal([]);
    })


    it('Ops after an add, copy, or move will not be affected by a change', () => {
      expect(transformPatch(obj, [{ op: 'add', path: '/k' }, { op: 'replace', path: '/k/g', value: 2 }], [{ op: 'remove', path: '/k' }])).to.deep.equal([{ op: 'add', path: '/k' }, { op: 'replace', path: '/k/g', value: 2 }]);
    })

  })

  describe('text', () => {
    it('applies text changes', () => {
      expect(transformPatch(obj, [{ op: '@changeText', path: '/text', value: [{insert:'testing'}] }], [{ op: '@changeText', path: '/text', value: [{insert:'test'}] }])).to.deep.equal([{ op: '@changeText', path: '/text', value: [{ retain: 4 }, {insert:'testing'}] }]);
      expect(transformPatch(obj, [{ op: '@changeText', path: '/text', value: [{insert:'testing'}] }], [{ op: '@changeText', path: '/text', value: [{insert:'test'}] }, { op: '@changeText', path: '/text', value: [{delete: 1}, {insert:'T'}] }])).to.deep.equal([{ op: '@changeText', path: '/text', value: [{ retain: 4 }, {insert:'testing'}] }]);
      expect(transformPatch(obj, [{ op: '@changeText', path: '/a/text', value: [{insert:'testing'}] }], [{ op: '@changeText', path: '/a', value: [{insert:'test'}] }])).to.deep.equal([]);
      expect(transformPatch(obj, [{ op: 'replace', path: '/text', value: true }], [{ op: '@changeText', path: '/text', value: [{insert:'test'}] }])).to.deep.equal([{ op: 'replace', path: '/text', value: true }]);
    })

    it('deletes values it overwrites', () => {
      expect(transformPatch(obj, [{ op: 'add', path: '/x/y', value: 1 }], [{ op: '@changeText', path: '/x', value: [{insert:'test'}] }])).to.deep.equal([]);
      expect(transformPatch(obj, [{ op: 'remove', path: '/x' }], [{ op: '@changeText', path: '/x', value: [{insert:'test'}] }])).to.deep.equal([]);
      expect(transformPatch(obj, [{ op: 'replace', path: '/x', value: 10 }], [{ op: '@changeText', path: '/x', value: [{insert:'test'}] }])).to.deep.equal([{ op: 'replace', path: '/x', value: 10 }]);
    })
  })

  describe('unsupported', () => {
    it('noops', () => {
      expect(transformPatch(obj, [{ op: 'add', path: '/x', value: 1 }], [{ op: 'unsupported' as 'add', path: '/x', value: true }])).to.deep.equal([{ op: 'add', path: '/x', value: 1 }]);
    })
  })

})
