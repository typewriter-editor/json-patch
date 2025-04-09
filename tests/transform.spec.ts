import { describe, expect, it } from 'vitest';
import { textDelta } from '../src/ops/delta.js';
import { transformPatch as originalTransformPatch } from '../src/transformPatch.js';
import { JSONPatchOp } from '../src/types.js';

const matrix = [[], [], [], [], [], [], []];
const arr = [{}, {}, {}, {}, {}, {}, {}];
const obj = { x: arr };

describe('transformPatch', () => {
  // verbose(true)
  const types = {
    '@txt': textDelta,
  };

  function transformPatch(obj: any, thisOps: JSONPatchOp[], otherOps: JSONPatchOp[]) {
    return originalTransformPatch(obj, thisOps, otherOps, types);
  }

  describe('soft writes', () => {
    it('does not overwrite empty objects used for lookups', () => {
      expect(
        transformPatch(
          {},
          [
            { op: 'add', path: '/obj', value: {} },
            { op: 'add', path: '/obj/foo', value: {} },
          ],
          [
            { op: 'add', path: '/obj', value: {} },
            { op: 'add', path: '/obj/foo', value: {} },
            { op: 'add', path: '/obj/foo/bar', value: 'hi1' },
          ]
        )
      ).toEqual([{ op: 'add', path: '/obj/foo/bar', value: 'hi1' }]);
    });

    it('does not overwrite writes marked as soft, allowing the first one to stand', () => {
      expect(
        transformPatch(
          {},
          [
            { op: 'add', soft: true, path: '/obj', value: {} },
            { op: 'add', soft: true, path: '/obj/foo', value: {} },
          ],
          [
            { op: 'add', soft: true, path: '/obj', value: {} },
            { op: 'add', soft: true, path: '/obj/foo', value: {} },
            { op: 'add', path: '/obj/foo/bar', value: 'hi1' },
          ]
        )
      ).toEqual([{ op: 'add', path: '/obj/foo/bar', value: 'hi1' }]);
    });

    it('does not overwrite writes marked as soft even if the first are not soft', () => {
      expect(
        transformPatch(
          {},
          [
            { op: 'add', path: '/obj', value: { test: true } },
            { op: 'add', path: '/obj/foo', value: { test: true } },
          ],
          [
            { op: 'add', soft: true, path: '/obj', value: { test: true } },
            { op: 'add', soft: true, path: '/obj/foo', value: { test: true } },
            { op: 'add', path: '/obj/foo/bar', value: 'hi1' },
          ]
        )
      ).toEqual([{ op: 'add', path: '/obj/foo/bar', value: 'hi1' }]);
    });

    it('does not overwrite writes marked as soft within an array', () => {
      expect(
        transformPatch(
          {},
          [{ op: 'add', path: '/obj/array/3', value: 'three' }],
          [{ op: 'add', soft: true, path: '/obj/array/3', value: 'three' }]
        )
      ).toEqual([]);
    });

    it('does not overwrite writes dependent on soft writes in an array', () => {
      expect(
        transformPatch(
          {},
          [{ op: 'add', path: '/obj/array/3', value: {} }],
          [
            { op: 'add', soft: true, path: '/obj/array/3', value: {} },
            { op: 'add', path: '/obj/array/3/foo', value: 'bar' },
          ]
        )
      ).toEqual([{ op: 'add', path: '/obj/array/3/foo', value: 'bar' }]);
    });

    it('does not overwrite soft writes in an array', () => {
      expect(
        transformPatch(
          {},
          [{ op: 'add', path: '/obj/array/3', value: 'test' }],
          [{ op: 'add', soft: true, path: '/obj/array/3', value: 'test' }]
        )
      ).toEqual([]);
    });
  });

  describe('allowing later writes', () => {
    it('removes writes that are overwritten', () => {
      expect(
        transformPatch(
          {},
          [{ op: 'add', path: '/obj', value: { test: true } }],
          [{ op: 'add', path: '/obj/foo', value: { test: true } }]
        )
      ).toEqual([]);
    });

    it('does not remove writes that are reset', () => {
      expect(
        transformPatch(
          {},
          [{ op: 'add', path: '/obj', value: { test: true } }],
          [
            { op: 'add', path: '/obj', value: { test: true } },
            { op: 'add', path: '/obj/foo', value: { test: true } },
          ]
        )
      ).toEqual([
        { op: 'add', path: '/obj', value: { test: true } },
        { op: 'add', path: '/obj/foo', value: { test: true } },
      ]);
    });

    it('removes unrelated writes that are reset', () => {
      expect(
        transformPatch(
          {},
          [
            { op: 'add', path: '/obj', value: { test: true } },
            { op: 'add', path: '/obj2', value: { test: true } },
          ],
          [
            { op: 'add', path: '/obj', value: { test: true } },
            { op: 'add', path: '/obj/foo', value: { test: true } },
            { op: 'add', path: '/obj2/foo', value: { test: true } },
          ]
        )
      ).toEqual([
        { op: 'add', path: '/obj', value: { test: true } },
        { op: 'add', path: '/obj/foo', value: { test: true } },
      ]);
    });
  });

  describe('operations', () => {
    describe('add vs', () => {
      it('add vs add - array', () => {
        expect(
          transformPatch(
            {},
            [{ op: 'add', path: '/array/0', value: 'zero' }],
            [{ op: 'add', path: '/array/1', value: 'two' }]
          )
        ).toEqual([{ op: 'add', path: '/array/2', value: 'two' }]);
      });

      it('add vs add - array', () => {
        expect(
          transformPatch(matrix, [{ op: 'add', path: '/1', value: 'hi1' }], [{ op: 'add', path: '/1', value: 'x' }])
        ).toEqual([{ op: 'add', path: '/1', value: 'x' }]);
        expect(
          transformPatch(matrix, [{ op: 'add', path: '/1', value: 'hi1' }], [{ op: 'add', path: '/1/foo', value: 'x' }])
        ).toEqual([{ op: 'add', path: '/2/foo', value: 'x' }]);
      });

      it('add vs add - object', () => {
        expect(
          transformPatch(obj, [{ op: 'add', path: '/x', value: 'hi1' }], [{ op: 'add', path: '/x', value: 'x' }])
        ).toEqual([{ op: 'add', path: '/x', value: 'x' }]);
      });

      it('add vs remove - array', () => {
        expect(
          transformPatch(matrix, [{ op: 'add', path: '/1', value: 'hi1' }], [{ op: 'remove', path: '/1' }])
        ).toEqual([{ op: 'remove', path: '/2' }]);
      });

      it('add vs remove - object', () => {
        expect(transformPatch(obj, [{ op: 'add', path: '/x', value: 'hi1' }], [{ op: 'remove', path: '/x' }])).toEqual(
          []
        );
      });

      it('add vs replace - array', () => {
        expect(
          transformPatch(matrix, [{ op: 'add', path: '/1', value: 'hi1' }], [{ op: 'replace', path: '/1', value: 'x' }])
        ).toEqual([{ op: 'replace', path: '/2', value: 'x' }]);
      });

      it('add vs replace - object', () => {
        expect(
          transformPatch(obj, [{ op: 'add', path: '/x', value: 'hi1' }], [{ op: 'replace', path: '/x', value: 'x' }])
        ).toEqual([{ op: 'replace', path: '/x', value: 'x' }]);
      });

      it('add vs copy - array', () => {
        expect(
          transformPatch(matrix, [{ op: 'add', path: '/1', value: 'hi1' }], [{ op: 'copy', from: '/0', path: '/1' }])
        ).toEqual([{ op: 'copy', from: '/0', path: '/1' }]);
        expect(
          transformPatch(matrix, [{ op: 'add', path: '/1', value: 'hi1' }], [{ op: 'copy', from: '/1', path: '/0' }])
        ).toEqual([{ op: 'copy', from: '/2', path: '/0' }]);
      });

      it('add vs copy - object', () => {
        expect(
          transformPatch(obj, [{ op: 'add', path: '/x', value: 'hi1' }], [{ op: 'copy', from: '/y', path: '/x' }])
        ).toEqual([{ op: 'copy', from: '/y', path: '/x' }]);
        expect(
          transformPatch(obj, [{ op: 'add', path: '/x', value: 'hi1' }], [{ op: 'copy', from: '/x', path: '/y' }])
        ).toEqual([]);
      });

      it('add vs move - array', () => {
        expect(
          transformPatch(matrix, [{ op: 'add', path: '/1', value: 'hi1' }], [{ op: 'move', from: '/0', path: '/1' }])
        ).toEqual([{ op: 'move', from: '/0', path: '/2' }]);
        expect(
          transformPatch(matrix, [{ op: 'add', path: '/1', value: 'hi1' }], [{ op: 'move', from: '/1', path: '/0' }])
        ).toEqual([{ op: 'move', from: '/2', path: '/0' }]);
      });

      it('add vs move - object', () => {
        expect(
          transformPatch(obj, [{ op: 'add', path: '/x', value: 'hi1' }], [{ op: 'move', from: '/y', path: '/x' }])
        ).toEqual([{ op: 'move', from: '/y', path: '/x' }]);
        expect(
          transformPatch(obj, [{ op: 'add', path: '/x', value: 'hi1' }], [{ op: 'move', from: '/x', path: '/y' }])
        ).toEqual([]);
      });
    });

    describe('remove vs', () => {
      it('remove vs add - array', () => {
        expect(transformPatch(matrix, [{ op: 'remove', path: '/1' }], [{ op: 'add', path: '/1', value: 'x' }])).toEqual(
          [{ op: 'add', path: '/1', value: 'x' }]
        );
        expect(
          transformPatch(matrix, [{ op: 'remove', path: '/1' }], [{ op: 'add', path: '/1/foo', value: 'x' }])
        ).toEqual([]);
        expect(
          transformPatch(matrix, [{ op: 'remove', path: '/1' }], [{ op: 'add', path: '/2/foo', value: 'x' }])
        ).toEqual([{ op: 'add', path: '/1/foo', value: 'x' }]);
      });

      it('remove vs add - object', () => {
        expect(transformPatch(obj, [{ op: 'remove', path: '/x' }], [{ op: 'add', path: '/x', value: 'x' }])).toEqual([
          { op: 'add', path: '/x', value: 'x' },
        ]);
      });

      it('remove vs remove - array', () => {
        expect(transformPatch(matrix, [{ op: 'remove', path: '/1' }], [{ op: 'remove', path: '/1' }])).toEqual([]);
      });

      it('remove vs remove - object', () => {
        expect(transformPatch(obj, [{ op: 'remove', path: '/x' }], [{ op: 'remove', path: '/x' }])).toEqual([]);
      });

      it('remove vs replace - array', () => {
        expect(
          transformPatch(matrix, [{ op: 'remove', path: '/1' }], [{ op: 'replace', path: '/1', value: 'x' }])
        ).toEqual([{ op: 'add', path: '/1', value: 'x' }]);
      });

      it('remove vs replace - object', () => {
        expect(
          transformPatch(obj, [{ op: 'remove', path: '/x' }], [{ op: 'replace', path: '/x', value: 'x' }])
        ).toEqual([{ op: 'replace', path: '/x', value: 'x' }]);
      });

      it('remove vs copy - array', () => {
        expect(
          transformPatch(matrix, [{ op: 'remove', path: '/1' }], [{ op: 'copy', from: '/0', path: '/1' }])
        ).toEqual([{ op: 'copy', from: '/0', path: '/1' }]);
        expect(
          transformPatch(matrix, [{ op: 'remove', path: '/1' }], [{ op: 'copy', from: '/1', path: '/0' }])
        ).toEqual([]);
        expect(
          transformPatch(
            matrix,
            [{ op: 'remove', path: '/1' }],
            [
              { op: 'copy', from: '/1', path: '/2' },
              { op: 'add', path: '/4', value: 'foo' },
            ]
          )
        ).toEqual([{ op: 'add', path: '/2', value: 'foo' }]);
      });

      it('remove vs copy - object', () => {
        expect(transformPatch(obj, [{ op: 'remove', path: '/x' }], [{ op: 'copy', from: '/y', path: '/x' }])).toEqual([
          { op: 'copy', from: '/y', path: '/x' },
        ]);
        expect(transformPatch(obj, [{ op: 'remove', path: '/x' }], [{ op: 'copy', from: '/x', path: '/y' }])).toEqual(
          []
        );
        expect(
          transformPatch(
            obj,
            [{ op: 'remove', path: '/x' }],
            [
              { op: 'copy', from: '/x', path: '/y' },
              { op: 'add', path: '/y/foo', value: 'hi' },
            ]
          )
        ).toEqual([]);
      });

      it('remove vs move - array', () => {
        expect(
          transformPatch(matrix, [{ op: 'remove', path: '/1' }], [{ op: 'move', from: '/0', path: '/1' }])
        ).toEqual([]);
        expect(
          transformPatch(matrix, [{ op: 'remove', path: '/1' }], [{ op: 'move', from: '/1', path: '/0' }])
        ).toEqual([]);
        expect(
          transformPatch(matrix, [{ op: 'remove', path: '/1' }], [{ op: 'move', from: '/1', path: '/5' }])
        ).toEqual([]);
        expect(
          transformPatch(matrix, [{ op: 'remove', path: '/1' }], [{ op: 'move', from: '/3', path: '/1' }])
        ).toEqual([{ op: 'move', from: '/2', path: '/1' }]);
      });

      it('remove vs move - array how it affects other ops later in the patch which must be adjusted where the move landed', () => {
        expect(transformPatch(arr, [{ op: 'remove', path: '/5' }], [{ op: 'move', from: '/5', path: '/1' }])).toEqual(
          []
        );
        expect(
          transformPatch(
            arr,
            [{ op: 'remove', path: '/5' }],
            [
              { op: 'move', from: '/5', path: '/1' },
              { op: 'replace', path: '/3/x', value: 'y' },
            ]
          )
        ).toEqual([{ op: 'replace', path: '/2/x', value: 'y' }]);
      });

      it('remove vs move - object', () => {
        expect(transformPatch(obj, [{ op: 'remove', path: '/x' }], [{ op: 'move', from: '/y', path: '/x' }])).toEqual([
          { op: 'move', from: '/y', path: '/x' },
        ]);
        expect(transformPatch(obj, [{ op: 'remove', path: '/x' }], [{ op: 'move', from: '/x', path: '/y' }])).toEqual(
          []
        );
      });
    });

    describe('replace vs', () => {
      it('replace vs add - array', () => {
        expect(
          transformPatch(matrix, [{ op: 'replace', path: '/1', value: 'hi1' }], [{ op: 'add', path: '/1', value: 'x' }])
        ).toEqual([{ op: 'add', path: '/1', value: 'x' }]);
        expect(
          transformPatch(
            matrix,
            [{ op: 'replace', path: '/1', value: 'hi1' }],
            [{ op: 'add', path: '/1/foo', value: 'x' }]
          )
        ).toEqual([]);
      });

      it('replace vs add - object', () => {
        expect(
          transformPatch(obj, [{ op: 'replace', path: '/x', value: 'hi1' }], [{ op: 'add', path: '/x', value: 'x' }])
        ).toEqual([{ op: 'add', path: '/x', value: 'x' }]);
      });

      it('replace vs remove - array', () => {
        expect(
          transformPatch(matrix, [{ op: 'replace', path: '/1', value: 'hi1' }], [{ op: 'remove', path: '/1' }])
        ).toEqual([]);
      });

      it('replace vs remove - object', () => {
        expect(
          transformPatch(obj, [{ op: 'replace', path: '/x', value: 'hi1' }], [{ op: 'remove', path: '/x' }])
        ).toEqual([]);
      });

      it('replace vs replace - array', () => {
        expect(
          transformPatch(
            matrix,
            [{ op: 'replace', path: '/1', value: 'hi1' }],
            [{ op: 'replace', path: '/1', value: 'x' }]
          )
        ).toEqual([{ op: 'replace', path: '/1', value: 'x' }]);
      });

      it('replace vs replace - object', () => {
        expect(
          transformPatch(
            obj,
            [{ op: 'replace', path: '/x', value: 'hi1' }],
            [{ op: 'replace', path: '/x', value: 'x' }]
          )
        ).toEqual([{ op: 'replace', path: '/x', value: 'x' }]);
      });

      it('replace vs copy - array', () => {
        expect(
          transformPatch(
            matrix,
            [{ op: 'replace', path: '/1', value: 'hi1' }],
            [{ op: 'copy', from: '/0', path: '/1' }]
          )
        ).toEqual([{ op: 'copy', from: '/0', path: '/1' }]);
        expect(
          transformPatch(
            matrix,
            [{ op: 'replace', path: '/1', value: 'hi1' }],
            [{ op: 'copy', from: '/1', path: '/0' }]
          )
        ).toEqual([]);
      });

      it('replace vs copy - object', () => {
        expect(
          transformPatch(obj, [{ op: 'replace', path: '/x', value: 'hi1' }], [{ op: 'copy', from: '/y', path: '/x' }])
        ).toEqual([{ op: 'copy', from: '/y', path: '/x' }]);
        expect(
          transformPatch(obj, [{ op: 'replace', path: '/x', value: 'hi1' }], [{ op: 'copy', from: '/x', path: '/y' }])
        ).toEqual([]);
      });

      it('replace vs move - array', () => {
        expect(
          transformPatch(
            matrix,
            [{ op: 'replace', path: '/1', value: 'hi1' }],
            [{ op: 'move', from: '/0', path: '/1' }]
          )
        ).toEqual([{ op: 'move', from: '/0', path: '/1' }]);
        expect(
          transformPatch(
            matrix,
            [{ op: 'replace', path: '/1', value: 'hi1' }],
            [{ op: 'move', from: '/1', path: '/0' }]
          )
        ).toEqual([]);
      });

      it('replace vs move - object', () => {
        expect(
          transformPatch(obj, [{ op: 'replace', path: '/x', value: 'hi1' }], [{ op: 'move', from: '/y', path: '/x' }])
        ).toEqual([{ op: 'move', from: '/y', path: '/x' }]);
        expect(
          transformPatch(obj, [{ op: 'replace', path: '/x', value: 'hi1' }], [{ op: 'move', from: '/x', path: '/y' }])
        ).toEqual([]);
      });
    });

    describe('copy vs', () => {
      it('copy vs add - array', () => {
        expect(
          transformPatch(matrix, [{ op: 'copy', from: '/3', path: '/1' }], [{ op: 'add', path: '/1', value: 'x' }])
        ).toEqual([{ op: 'add', path: '/1', value: 'x' }]);
        expect(
          transformPatch(matrix, [{ op: 'copy', from: '/3', path: '/1' }], [{ op: 'add', path: '/1/foo', value: 'x' }])
        ).toEqual([{ op: 'add', path: '/2/foo', value: 'x' }]);
      });

      it('copy vs add - object', () => {
        expect(
          transformPatch(obj, [{ op: 'copy', from: '/y', path: '/x' }], [{ op: 'add', path: '/x', value: 'x' }])
        ).toEqual([{ op: 'add', path: '/x', value: 'x' }]);
      });

      it('copy vs remove - array', () => {
        expect(
          transformPatch(matrix, [{ op: 'copy', from: '/3', path: '/1' }], [{ op: 'remove', path: '/1' }])
        ).toEqual([{ op: 'remove', path: '/2' }]);
      });

      it('copy vs remove - object', () => {
        expect(transformPatch(obj, [{ op: 'copy', from: '/y', path: '/x' }], [{ op: 'remove', path: '/x' }])).toEqual(
          []
        );
      });

      it('copy vs replace - array', () => {
        expect(
          transformPatch(matrix, [{ op: 'copy', from: '/3', path: '/1' }], [{ op: 'replace', path: '/1', value: 'x' }])
        ).toEqual([{ op: 'replace', path: '/2', value: 'x' }]);
      });

      it('copy vs replace - object', () => {
        expect(
          transformPatch(obj, [{ op: 'copy', from: '/y', path: '/x' }], [{ op: 'replace', path: '/x', value: 'x' }])
        ).toEqual([{ op: 'replace', path: '/x', value: 'x' }]);
      });

      it('copy vs copy - array', () => {
        expect(
          transformPatch(matrix, [{ op: 'copy', from: '/3', path: '/1' }], [{ op: 'copy', from: '/0', path: '/1' }])
        ).toEqual([{ op: 'copy', from: '/0', path: '/1' }]);
        expect(
          transformPatch(matrix, [{ op: 'copy', from: '/3', path: '/1' }], [{ op: 'copy', from: '/1', path: '/0' }])
        ).toEqual([{ op: 'copy', from: '/2', path: '/0' }]);
      });

      it('copy vs copy - object', () => {
        expect(
          transformPatch(obj, [{ op: 'copy', from: '/y', path: '/x' }], [{ op: 'copy', from: '/y', path: '/x' }])
        ).toEqual([{ op: 'copy', from: '/y', path: '/x' }]);
        expect(
          transformPatch(obj, [{ op: 'copy', from: '/y', path: '/x' }], [{ op: 'copy', from: '/x', path: '/y' }])
        ).toEqual([]);
      });

      it('copy vs move - array', () => {
        expect(
          transformPatch(matrix, [{ op: 'copy', from: '/3', path: '/1' }], [{ op: 'move', from: '/0', path: '/1' }])
        ).toEqual([{ op: 'move', from: '/0', path: '/2' }]);
        expect(
          transformPatch(matrix, [{ op: 'copy', from: '/3', path: '/1' }], [{ op: 'move', from: '/1', path: '/0' }])
        ).toEqual([{ op: 'move', from: '/2', path: '/0' }]);
      });

      it('copy vs move - object', () => {
        expect(
          transformPatch(obj, [{ op: 'copy', from: '/y', path: '/x' }], [{ op: 'move', from: '/y', path: '/x' }])
        ).toEqual([{ op: 'move', from: '/y', path: '/x' }]);
        expect(
          transformPatch(obj, [{ op: 'copy', from: '/y', path: '/x' }], [{ op: 'move', from: '/x', path: '/y' }])
        ).toEqual([]);
      });
    });

    describe('move vs', () => {
      it('move vs add - array', () => {
        expect(
          transformPatch(matrix, [{ op: 'move', from: '/3', path: '/1' }], [{ op: 'add', path: '/1', value: 'x' }])
        ).toEqual([{ op: 'add', path: '/1', value: 'x' }]);
        expect(
          transformPatch(matrix, [{ op: 'move', from: '/3', path: '/1' }], [{ op: 'add', path: '/1/foo', value: 'x' }])
        ).toEqual([{ op: 'add', path: '/2/foo', value: 'x' }]);
      });

      it('move vs add - object', () => {
        expect(
          transformPatch(obj, [{ op: 'move', from: '/y', path: '/x' }], [{ op: 'add', path: '/x', value: 'x' }])
        ).toEqual([{ op: 'add', path: '/x', value: 'x' }]);
      });

      it('move vs remove - array', () => {
        expect(
          transformPatch(matrix, [{ op: 'move', from: '/3', path: '/1' }], [{ op: 'remove', path: '/1' }])
        ).toEqual([{ op: 'remove', path: '/2' }]);
      });

      it('move vs remove - object', () => {
        expect(transformPatch(obj, [{ op: 'move', from: '/y', path: '/x' }], [{ op: 'remove', path: '/x' }])).toEqual(
          []
        );
      });

      it('move vs replace - array', () => {
        expect(
          transformPatch(matrix, [{ op: 'move', from: '/3', path: '/1' }], [{ op: 'replace', path: '/1', value: 'x' }])
        ).toEqual([{ op: 'replace', path: '/2', value: 'x' }]);
      });

      it('move vs replace - object', () => {
        expect(
          transformPatch(obj, [{ op: 'move', from: '/y', path: '/x' }], [{ op: 'replace', path: '/x', value: 'x' }])
        ).toEqual([{ op: 'replace', path: '/x', value: 'x' }]);
      });

      it('move vs copy - array', () => {
        expect(
          transformPatch(matrix, [{ op: 'move', from: '/3', path: '/1' }], [{ op: 'copy', from: '/0', path: '/1' }])
        ).toEqual([{ op: 'copy', from: '/0', path: '/1' }]);
        expect(
          transformPatch(matrix, [{ op: 'move', from: '/3', path: '/1' }], [{ op: 'copy', from: '/1', path: '/0' }])
        ).toEqual([{ op: 'copy', from: '/2', path: '/0' }]);
      });

      it('move vs copy - object', () => {
        expect(
          transformPatch(obj, [{ op: 'move', from: '/y', path: '/x' }], [{ op: 'copy', from: '/y', path: '/foo' }])
        ).toEqual([{ op: 'copy', from: '/x', path: '/foo' }]);
        expect(
          transformPatch(obj, [{ op: 'move', from: '/y', path: '/x' }], [{ op: 'copy', from: '/y', path: '/x' }])
        ).toEqual([]);
        expect(
          transformPatch(obj, [{ op: 'move', from: '/y', path: '/x' }], [{ op: 'copy', from: '/x', path: '/y' }])
        ).toEqual([]);
      });

      it('move vs move - array', () => {
        expect(
          transformPatch(matrix, [{ op: 'move', from: '/3', path: '/1' }], [{ op: 'move', from: '/0', path: '/1' }])
        ).toEqual([{ op: 'move', from: '/0', path: '/1' }]);
        expect(
          transformPatch(matrix, [{ op: 'move', from: '/3', path: '/1' }], [{ op: 'move', from: '/1', path: '/0' }])
        ).toEqual([{ op: 'move', from: '/2', path: '/0' }]);
      });

      it('move vs move - object', () => {
        expect(
          transformPatch(obj, [{ op: 'move', from: '/y', path: '/x' }], [{ op: 'move', from: '/y', path: '/foo' }])
        ).toEqual([{ op: 'move', from: '/x', path: '/foo' }]);
        expect(
          transformPatch(obj, [{ op: 'move', from: '/y', path: '/x' }], [{ op: 'move', from: '/x', path: '/foo' }])
        ).toEqual([]);
      });
    });

    describe('increment vs', () => {
      it('increment vs add - array', () => {
        expect(
          transformPatch(matrix, [{ op: '@inc', path: '/1', value: 4 }], [{ op: 'add', path: '/1', value: 'x' }])
        ).toEqual([{ op: 'add', path: '/1', value: 'x' }]);
        expect(
          transformPatch(matrix, [{ op: '@inc', path: '/1', value: 4 }], [{ op: 'add', path: '/1/foo', value: 'x' }])
        ).toEqual([]);
      });

      it('increment vs add - object', () => {
        expect(
          transformPatch(obj, [{ op: '@inc', path: '/x', value: 4 }], [{ op: 'add', path: '/x', value: 'x' }])
        ).toEqual([{ op: 'add', path: '/x', value: 'x' }]);
      });

      it('increment vs remove - array', () => {
        expect(transformPatch(matrix, [{ op: '@inc', path: '/1', value: 4 }], [{ op: 'remove', path: '/1' }])).toEqual([
          { op: 'remove', path: '/1' },
        ]);
      });

      it('increment vs remove - object', () => {
        expect(transformPatch(obj, [{ op: '@inc', path: '/x', value: 4 }], [{ op: 'remove', path: '/x' }])).toEqual([
          { op: 'remove', path: '/x' },
        ]);
      });

      it('increment vs replace - array', () => {
        expect(
          transformPatch(matrix, [{ op: '@inc', path: '/1', value: 4 }], [{ op: 'replace', path: '/1', value: 'x' }])
        ).toEqual([{ op: 'replace', path: '/1', value: 'x' }]);
      });

      it('increment vs replace - object', () => {
        expect(
          transformPatch(obj, [{ op: '@inc', path: '/x', value: 4 }], [{ op: 'replace', path: '/x', value: 'x' }])
        ).toEqual([{ op: 'replace', path: '/x', value: 'x' }]);
      });

      it('increment vs copy - array', () => {
        expect(
          transformPatch(matrix, [{ op: '@inc', path: '/1', value: 4 }], [{ op: 'copy', from: '/0', path: '/1' }])
        ).toEqual([{ op: 'copy', from: '/0', path: '/1' }]);
        expect(
          transformPatch(matrix, [{ op: '@inc', path: '/1', value: 4 }], [{ op: 'copy', from: '/1', path: '/0' }])
        ).toEqual([{ op: 'copy', from: '/1', path: '/0' }]);
      });

      it('increment vs copy - object', () => {
        expect(
          transformPatch(obj, [{ op: '@inc', path: '/x', value: 4 }], [{ op: 'copy', from: '/y', path: '/x' }])
        ).toEqual([{ op: 'copy', from: '/y', path: '/x' }]);
        expect(
          transformPatch(obj, [{ op: '@inc', path: '/x', value: 4 }], [{ op: 'copy', from: '/x', path: '/y' }])
        ).toEqual([{ op: 'copy', from: '/x', path: '/y' }]);
      });

      it('increment vs move - array', () => {
        expect(
          transformPatch(matrix, [{ op: '@inc', path: '/1', value: 4 }], [{ op: 'move', from: '/0', path: '/1' }])
        ).toEqual([{ op: 'move', from: '/0', path: '/1' }]);
        expect(
          transformPatch(matrix, [{ op: '@inc', path: '/1', value: 4 }], [{ op: 'move', from: '/1', path: '/0' }])
        ).toEqual([{ op: 'move', from: '/1', path: '/0' }]);
      });

      it('increment vs move - object', () => {
        expect(
          transformPatch(obj, [{ op: '@inc', path: '/x', value: 4 }], [{ op: 'move', from: '/y', path: '/x' }])
        ).toEqual([{ op: 'move', from: '/y', path: '/x' }]);
        expect(
          transformPatch(obj, [{ op: '@inc', path: '/x', value: 4 }], [{ op: 'move', from: '/x', path: '/y' }])
        ).toEqual([{ op: 'move', from: '/x', path: '/y' }]);
      });

      it('increment vs increment - object', () => {
        expect(
          transformPatch(obj, [{ op: '@inc', path: '/x', value: 4 }], [{ op: '@inc', path: '/x', value: 2 }])
        ).toEqual([{ op: '@inc', path: '/x', value: 2 }]);
      });
    });
  });

  describe('array', () => {
    it('ensure non-arrays are handled as properties', () => {
      expect(
        transformPatch({}, [{ op: 'add', path: '/0', value: 'x' }], [{ op: 'add', path: '/1', value: 'hi1' }])
      ).toEqual([{ op: 'add', path: '/1', value: 'hi1' }]);
    });

    it('bumps paths when list elements are inserted or removed', () => {
      expect(
        transformPatch(matrix, [{ op: 'add', path: '/0', value: 'x' }], [{ op: 'add', path: '/1', value: 'hi1' }])
      ).toEqual([{ op: 'add', path: '/2', value: 'hi1' }]);
      expect(
        transformPatch(matrix, [{ op: 'add', path: '/0', value: 'x' }], [{ op: 'add', path: '/0', value: 'hi2' }])
      ).toEqual([{ op: 'add', path: '/0', value: 'hi2' }]);
      expect(
        transformPatch(matrix, [{ op: 'add', path: '/1', value: 'x' }], [{ op: 'add', path: '/0', value: 'hi3' }])
      ).toEqual([{ op: 'add', path: '/0', value: 'hi3' }]);
      expect(
        transformPatch(matrix, [{ op: 'add', path: '/0', value: 'x' }], [{ op: '@txt', path: '/1', value: [] }])
      ).toEqual([{ op: '@txt', path: '/2', value: [] }]);
      expect(
        transformPatch(matrix, [{ op: 'add', path: '/0', value: 'x' }], [{ op: '@txt', path: '/0', value: [] }])
      ).toEqual([{ op: '@txt', path: '/1', value: [] }]);
      expect(
        transformPatch(matrix, [{ op: 'add', path: '/1', value: 'x' }], [{ op: '@txt', path: '/0', value: [] }])
      ).toEqual([{ op: '@txt', path: '/0', value: [] }]);
      expect(
        transformPatch(matrix, [{ op: 'copy', from: '/x', path: '/0' }], [{ op: 'add', path: '/1', value: 'hi1' }])
      ).toEqual([{ op: 'add', path: '/2', value: 'hi1' }]);
      expect(
        transformPatch(matrix, [{ op: 'copy', from: '/x', path: '/0' }], [{ op: 'add', path: '/0', value: 'hi2' }])
      ).toEqual([{ op: 'add', path: '/0', value: 'hi2' }]);
      expect(
        transformPatch(matrix, [{ op: 'copy', from: '/x', path: '/1' }], [{ op: 'add', path: '/0', value: 'hi3' }])
      ).toEqual([{ op: 'add', path: '/0', value: 'hi3' }]);

      expect(transformPatch(matrix, [{ op: 'remove', path: '/0' }], [{ op: 'add', path: '/1', value: 'hi4' }])).toEqual(
        [{ op: 'add', path: '/0', value: 'hi4' }]
      );
      expect(transformPatch(matrix, [{ op: 'remove', path: '/1' }], [{ op: 'add', path: '/0', value: 'hi5' }])).toEqual(
        [{ op: 'add', path: '/0', value: 'hi5' }]
      );
      expect(transformPatch(matrix, [{ op: 'remove', path: '/0' }], [{ op: 'add', path: '/0', value: 'hi6' }])).toEqual(
        [{ op: 'add', path: '/0', value: 'hi6' }]
      );
      expect(transformPatch(matrix, [{ op: 'remove', path: '/2' }], [{ op: 'add', path: '/2', value: 'hi7' }])).toEqual(
        [{ op: 'add', path: '/2', value: 'hi7' }]
      );
      expect(
        transformPatch(obj, [{ op: 'add', path: '/x/5', value: 'x' }], [{ op: 'add', path: '/x/3/x', value: 'hi8' }])
      ).toEqual([{ op: 'add', path: '/x/3/x', value: 'hi8' }]);
      expect(
        transformPatch(obj, [{ op: 'add', path: '/x/0', value: 'x' }], [{ op: 'add', path: '/x/3/x', value: 'hi9' }])
      ).toEqual([{ op: 'add', path: '/x/4/x', value: 'hi9' }]);
      expect(
        transformPatch(obj, [{ op: 'add', path: '/x/3', value: 'x' }], [{ op: 'add', path: '/x/3/x', value: 'hi9' }])
      ).toEqual([{ op: 'add', path: '/x/4/x', value: 'hi9' }]);
      expect(transformPatch(matrix, [{ op: 'remove', path: '/0' }], [{ op: '@txt', path: '/1', value: [] }])).toEqual([
        { op: '@txt', path: '/0', value: [] },
      ]);
      expect(transformPatch(matrix, [{ op: 'remove', path: '/1' }], [{ op: '@txt', path: '/0', value: [] }])).toEqual([
        { op: '@txt', path: '/0', value: [] },
      ]);
      expect(transformPatch(matrix, [{ op: 'remove', path: '/0' }], [{ op: '@txt', path: '/0', value: [] }])).toEqual([
        { op: 'add', path: '/0', value: null },
        { op: '@txt', path: '/0', value: [] },
      ]);

      expect(transformPatch(matrix, [{ op: 'add', path: '/0', value: 'x' }], [{ op: 'remove', path: '/0' }])).toEqual([
        { op: 'remove', path: '/1' },
      ]);
    });

    it('test no-op', () => {
      expect(transformPatch(matrix, [{ op: 'test', path: '/0', value: 'x' }], [{ op: 'remove', path: '/0' }])).toEqual([
        { op: 'remove', path: '/0' },
      ]);
    });

    it('converts ops on deleted elements to noops', () => {
      expect(transformPatch(matrix, [{ op: 'remove', path: '/1' }], [{ op: 'remove', path: '/1' }])).toEqual([]);
      expect(transformPatch(matrix, [{ op: 'remove', path: '/1' }], [{ op: 'add', path: '/1/x' }])).toEqual([]);
    });

    it('converts replace ops on deleted elements to add ops', () => {
      expect(transformPatch(matrix, [{ op: 'remove', path: '/1' }], [{ op: '@txt', path: '/1', value: [] }])).toEqual([
        { op: 'add', path: '/1', value: null },
        { op: '@txt', path: '/1', value: [] },
      ]);
      expect(transformPatch(matrix, [{ op: 'remove', path: '/1' }], [{ op: 'add', path: '/1' }])).toEqual([
        { op: 'add', path: '/1' },
      ]);
    });

    it('converts replace to add on deleted elements', () => {
      // Fixed behavior with replace which is the same as remove+add, so if there is a remove then it converts to an add
      expect(
        transformPatch(matrix, [{ op: 'remove', path: '/1' }], [{ op: 'replace', path: '/1', value: 'hi1' }])
      ).toEqual([{ op: 'add', path: '/1', value: 'hi1' }]);
    });

    it('converts ops on children of replaced elements to noops', () => {
      expect(
        transformPatch(matrix, [{ op: 'replace', path: '/1', value: 'hi1' }], [{ op: 'remove', path: '/1' }])
      ).toEqual([]);
      expect(
        transformPatch(arr, [{ op: 'replace', path: '/1', value: 'y' }], [{ op: 'add', path: '/1/x', value: 'hi' }])
      ).toEqual([]);
      expect(
        transformPatch(matrix, [{ op: 'replace', path: '/1', value: 'y' }], [{ op: '@txt', path: '/1', value: [] }])
      ).toEqual([{ op: '@txt', path: '/1', value: [] }]);
      expect(
        transformPatch(matrix, [{ op: 'replace', path: '/0', value: 'y' }], [{ op: 'add', path: '/0', value: 'hi' }])
      ).toEqual([{ op: 'add', path: '/0', value: 'hi' }]);
    });

    it('Puts the transformed op second if two inserts are simultaneous', () => {
      expect(
        transformPatch(matrix, [{ op: 'add', path: '/1', value: 'b' }], [{ op: 'add', path: '/1', value: 'a' }])
      ).toEqual([{ op: 'add', path: '/1', value: 'a' }]);
    });

    it('converts an attempt to re-delete a list element into a no-op', () => {
      expect(transformPatch(matrix, [{ op: 'remove', path: '/1' }], [{ op: 'remove', path: '/1' }])).toEqual([]);
    });

    it('moves ops on a moved element with the element', () => {
      expect(transformPatch(matrix, [{ op: 'move', from: '/4', path: '/10' }], [{ op: 'remove', path: '/4' }])).toEqual(
        [{ op: 'remove', path: '/10' }]
      );
      expect(
        transformPatch(matrix, [{ op: 'move', from: '/4', path: '/10' }], [{ op: 'replace', path: '/4', value: 'a' }])
      ).toEqual([{ op: 'replace', path: '/10', value: 'a' }]);
      expect(
        transformPatch(matrix, [{ op: 'move', from: '/4', path: '/10' }], [{ op: '@txt', path: '/4', value: [] }])
      ).toEqual([{ op: '@txt', path: '/10', value: [] }]);
      expect(
        transformPatch(matrix, [{ op: 'move', from: '/4', path: '/10' }], [{ op: 'add', path: '/4/1', value: 'a' }])
      ).toEqual([{ op: 'add', path: '/10/1', value: 'a' }]);
      expect(
        transformPatch(matrix, [{ op: 'move', from: '/4', path: '/10' }], [{ op: 'replace', path: '/4/1', value: 'a' }])
      ).toEqual([{ op: 'replace', path: '/10/1', value: 'a' }]);

      expect(
        transformPatch(matrix, [{ op: 'move', from: '/0', path: '/1' }], [{ op: 'add', path: '/0', value: null }])
      ).toEqual([{ op: 'add', path: '/0', value: null }]);
      expect(
        transformPatch(matrix, [{ op: 'move', from: '/5', path: '/1' }], [{ op: 'add', path: '/5', value: 'x' }])
      ).toEqual([{ op: 'add', path: '/6', value: 'x' }]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/5', path: '/1' }], [{ op: 'remove', path: '/5' }])).toEqual([
        { op: 'remove', path: '/1' },
      ]);
      expect(
        transformPatch(matrix, [{ op: 'move', from: '/0', path: '/0' }], [{ op: 'add', path: '/0', value: {} }])
      ).toEqual([{ op: 'add', path: '/0', value: {} }]);
      expect(
        transformPatch(matrix, [{ op: 'move', from: '/1', path: '/0' }], [{ op: 'add', path: '/0', value: [] }])
      ).toEqual([{ op: 'add', path: '/0', value: [] }]);
      expect(
        transformPatch(matrix, [{ op: 'move', from: '/0', path: '/1' }], [{ op: 'add', path: '/2', value: 'x' }])
      ).toEqual([{ op: 'add', path: '/2', value: 'x' }]);
      expect(
        transformPatch(matrix, [{ op: 'move', from: '/10', path: '/1' }], [{ op: 'add', path: '/5', value: 'x' }])
      ).toEqual([{ op: 'add', path: '/6', value: 'x' }]);
      expect(
        transformPatch(matrix, [{ op: 'move', from: '/1', path: '/10' }], [{ op: 'add', path: '/1', value: 'x' }])
      ).toEqual([{ op: 'add', path: '/1', value: 'x' }]);
      expect(
        transformPatch(matrix, [{ op: 'move', from: '/1', path: '/10' }], [{ op: 'add', path: '/2', value: 'x' }])
      ).toEqual([{ op: 'add', path: '/1', value: 'x' }]);
      expect(
        transformPatch(matrix, [{ op: 'move', from: '/0', path: '/10' }], [{ op: 'move', from: '/3', path: '/5' }])
      ).toEqual([{ op: 'move', from: '/2', path: '/4' }]);
    });

    it('moves target index on remove/add', () => {
      expect(
        transformPatch(matrix, [{ op: 'remove', path: '/1', value: 'x' }], [{ op: 'move', from: '/0', path: '/2' }])
      ).toEqual([{ op: 'move', from: '/0', path: '/1' }]);
      expect(
        transformPatch(matrix, [{ op: 'remove', path: '/1', value: 'x' }], [{ op: 'move', from: '/2', path: '/4' }])
      ).toEqual([{ op: 'move', from: '/1', path: '/3' }]);
      expect(
        transformPatch(matrix, [{ op: 'add', path: '/1', value: 'x' }], [{ op: 'move', from: '/0', path: '/2' }])
      ).toEqual([{ op: 'move', from: '/0', path: '/3' }]);
      expect(
        transformPatch(matrix, [{ op: 'add', path: '/1', value: 'x' }], [{ op: 'move', from: '/2', path: '/4' }])
      ).toEqual([{ op: 'move', from: '/3', path: '/5' }]);
      expect(
        transformPatch(matrix, [{ op: 'add', path: '/0', value: 28 }], [{ op: 'move', from: '/0', path: '/0' }])
      ).toEqual([]);
    });

    it('tiebreaks move vs. add/delete', () => {
      expect(transformPatch(matrix, [{ op: 'remove', path: '/0' }], [{ op: 'move', from: '/0', path: '/2' }])).toEqual(
        []
      );
      expect(
        transformPatch(matrix, [{ op: 'add', path: '/0', value: 'x' }], [{ op: 'move', from: '/0', path: '/2' }])
      ).toEqual([{ op: 'move', from: '/1', path: '/3' }]);
    });

    it('replacement vs. deletion', () => {
      expect(
        transformPatch(matrix, [{ op: 'remove', path: '/0' }], [{ op: 'replace', path: '/0', value: 'y' }])
      ).toEqual([{ op: 'add', path: '/0', value: 'y' }]);
      expect(transformPatch(matrix, [{ op: 'remove', path: '/0' }], [{ op: 'add', path: '/0', value: 'y' }])).toEqual([
        { op: 'add', path: '/0', value: 'y' },
      ]);
    });

    it('replacement vs. insertion', () => {
      expect(
        transformPatch(matrix, [{ op: 'add', path: '/0', value: 'x' }], [{ op: 'replace', path: '/0', value: 'y' }])
      ).toEqual([{ op: 'replace', path: '/1', value: 'y' }]);
      expect(
        transformPatch(matrix, [{ op: 'replace', path: '/0', value: 'x' }], [{ op: 'add', path: '/5', value: 'y' }])
      ).toEqual([{ op: 'add', path: '/5', value: 'y' }]);
    });

    it('replacement vs. replacement', () => {
      expect(
        transformPatch(matrix, [{ op: 'replace', path: '/0', value: 'x' }], [{ op: 'replace', path: '/0', value: 'y' }])
      ).toEqual([{ op: 'replace', path: '/0', value: 'y' }]);
    });

    it('move vs. move', () => {
      expect(
        transformPatch(matrix, [{ op: 'move', from: '/2', path: '/1' }], [{ op: 'move', from: '/0', path: '/2' }])
      ).toEqual([{ op: 'move', from: '/0', path: '/3' }]);
      expect(
        transformPatch(matrix, [{ op: 'move', from: '/2', path: '/0' }], [{ op: 'move', from: '/0', path: '/2' }])
      ).toEqual([{ op: 'move', from: '/1', path: '/2' }]);
      expect(
        transformPatch(matrix, [{ op: 'move', from: '/1', path: '/0' }], [{ op: 'move', from: '/0', path: '/2' }])
      ).toEqual([{ op: 'move', from: '/1', path: '/2' }]);

      expect(
        transformPatch(matrix, [{ op: 'move', from: '/3', path: '/0' }], [{ op: 'move', from: '/2', path: '/3' }])
      ).toEqual([]);
      expect(
        transformPatch(matrix, [{ op: 'move', from: '/3', path: '/0' }], [{ op: 'move', from: '/1', path: '/3' }])
      ).toEqual([{ op: 'move', from: '/2', path: '/3' }]);

      expect(
        transformPatch(matrix, [{ op: 'move', from: '/5', path: '/0' }], [{ op: 'move', from: '/3', path: '/3' }])
      ).toEqual([]);
      expect(
        transformPatch(matrix, [{ op: 'move', from: '/1', path: '/0' }], [{ op: 'move', from: '/2', path: '/0' }])
      ).toEqual([{ op: 'move', from: '/2', path: '/0' }]);
      expect(
        transformPatch(matrix, [{ op: 'move', from: '/5', path: '/0' }], [{ op: 'move', from: '/2', path: '/0' }])
      ).toEqual([{ op: 'move', from: '/3', path: '/0' }]);
      expect(
        transformPatch(matrix, [{ op: 'move', from: '/2', path: '/0' }], [{ op: 'move', from: '/2', path: '/5' }])
      ).toEqual([{ op: 'move', from: '/0', path: '/5' }]);
      expect(
        transformPatch(matrix, [{ op: 'move', from: '/1', path: '/0' }], [{ op: 'move', from: '/0', path: '/1' }])
      ).toEqual([]);
      expect(
        transformPatch(matrix, [{ op: 'move', from: '/1', path: '/3' }], [{ op: 'move', from: '/3', path: '/1' }])
      ).toEqual([{ op: 'move', from: '/2', path: '/1' }]);
      expect(
        transformPatch(matrix, [{ op: 'move', from: '/3', path: '/1' }], [{ op: 'move', from: '/1', path: '/3' }])
      ).toEqual([{ op: 'move', from: '/2', path: '/3' }]);
      expect(
        transformPatch(matrix, [{ op: 'move', from: '/0', path: '/1' }], [{ op: 'move', from: '/2', path: '/6' }])
      ).toEqual([{ op: 'move', from: '/2', path: '/6' }]);
      expect(
        transformPatch(matrix, [{ op: 'move', from: '/1', path: '/0' }], [{ op: 'move', from: '/2', path: '/6' }])
      ).toEqual([{ op: 'move', from: '/2', path: '/6' }]);
      expect(
        transformPatch(matrix, [{ op: 'move', from: '/2', path: '/1' }], [{ op: 'move', from: '/0', path: '/1' }])
      ).toEqual([{ op: 'move', from: '/0', path: '/1' }]);
      expect(
        transformPatch(matrix, [{ op: 'move', from: '/1', path: '/0' }], [{ op: 'move', from: '/0', path: '/0' }])
      ).toEqual([]);
      expect(
        transformPatch(matrix, [{ op: 'move', from: '/1', path: '/3' }], [{ op: 'move', from: '/0', path: '/1' }])
      ).toEqual([{ op: 'move', from: '/0', path: '/1' }]);
      expect(
        transformPatch(matrix, [{ op: 'move', from: '/3', path: '/2' }], [{ op: 'move', from: '/2', path: '/1' }])
      ).toEqual([{ op: 'move', from: '/3', path: '/1' }]);
      expect(
        transformPatch(matrix, [{ op: 'move', from: '/2', path: '/1' }], [{ op: 'move', from: '/3', path: '/2' }])
      ).toEqual([]);
    });

    it('changes indices correctly around a move', () => {
      expect(
        transformPatch(matrix, [{ op: 'move', from: '/1', path: '/0' }], [{ op: 'add', path: '/0/0', value: {} }])
      ).toEqual([{ op: 'add', path: '/1/0', value: {} }]);
      expect(transformPatch(matrix, [{ op: 'remove', path: '/0' }], [{ op: 'move', from: '/1', path: '/0' }])).toEqual(
        []
      );
      expect(transformPatch(matrix, [{ op: 'remove', path: '/1' }], [{ op: 'move', from: '/0', path: '/1' }])).toEqual(
        []
      );
      expect(transformPatch(matrix, [{ op: 'remove', path: '/2' }], [{ op: 'move', from: '/6', path: '/0' }])).toEqual([
        { op: 'move', from: '/5', path: '/0' },
      ]);
      expect(transformPatch(matrix, [{ op: 'remove', path: '/2' }], [{ op: 'move', from: '/1', path: '/0' }])).toEqual([
        { op: 'move', from: '/1', path: '/0' },
      ]);
      expect(transformPatch(matrix, [{ op: 'remove', path: '/1' }], [{ op: 'move', from: '/2', path: '/1' }])).toEqual(
        []
      );

      expect(transformPatch(matrix, [{ op: 'move', from: '/1', path: '/2' }], [{ op: 'remove', path: '/2' }])).toEqual([
        { op: 'remove', path: '/1' },
      ]);
      expect(transformPatch(matrix, [{ op: 'move', from: '/2', path: '/1' }], [{ op: 'remove', path: '/1' }])).toEqual([
        { op: 'remove', path: '/2' },
      ]);

      expect(transformPatch(matrix, [{ op: 'move', from: '/0', path: '/1' }], [{ op: 'remove', path: '/1' }])).toEqual([
        { op: 'remove', path: '/0' },
      ]);

      expect(
        transformPatch(matrix, [{ op: 'move', from: '/1', path: '/0' }], [{ op: 'replace', path: '/1', value: 2 }])
      ).toEqual([{ op: 'replace', path: '/0', value: 2 }]);
      expect(
        transformPatch(matrix, [{ op: 'move', from: '/0', path: '/1' }], [{ op: 'replace', path: '/1', value: 3 }])
      ).toEqual([{ op: 'replace', path: '/0', value: 3 }]);
      expect(
        transformPatch(matrix, [{ op: 'move', from: '/1', path: '/0' }], [{ op: 'replace', path: '/0', value: 4 }])
      ).toEqual([{ op: 'replace', path: '/1', value: 4 }]);
    });

    it('changes indices correctly around a move from a non-list', () => {
      expect(
        transformPatch(matrix, [{ op: 'move', from: '/x', path: '/0' }], [{ op: 'add', path: '/0/0', value: {} }])
      ).toEqual([{ op: 'add', path: '/1/0', value: {} }]);
      expect(
        transformPatch(matrix, [{ op: 'move', from: '/x', path: '/0' }], [{ op: 'add', path: '/0', value: {} }])
      ).toEqual([{ op: 'add', path: '/0', value: {} }]);
      expect(
        transformPatch(matrix, [{ op: 'move', from: '/0', path: '/x' }], [{ op: 'add', path: '/0', value: {} }])
      ).toEqual([{ op: 'add', path: '/0', value: {} }]);
      expect(
        transformPatch(matrix, [{ op: 'move', from: '/x', path: '/1' }], [{ op: 'add', path: '/3', value: {} }])
      ).toEqual([{ op: 'add', path: '/4', value: {} }]);
      expect(
        transformPatch(matrix, [{ op: 'move', from: '/x', path: '/1' }], [{ op: 'move', from: '/1', path: '/3' }])
      ).toEqual([{ op: 'move', from: '/2', path: '/4' }]);
      expect(
        transformPatch(matrix, [{ op: 'move', from: '/1', path: '/x' }], [{ op: 'move', from: '/1', path: '/3' }])
      ).toEqual([{ op: 'move', from: '/x', path: '/2' }]);
      expect(
        transformPatch(matrix, [{ op: 'move', from: '/2', path: '/x' }], [{ op: 'move', from: '/3', path: '/1' }])
      ).toEqual([{ op: 'move', from: '/2', path: '/1' }]);
      expect(
        transformPatch(matrix, [{ op: 'move', from: '/x', path: '/2' }], [{ op: 'move', from: '/3', path: '/1' }])
      ).toEqual([{ op: 'move', from: '/4', path: '/1' }]);
    });

    it('add vs. move', () => {
      expect(
        transformPatch(matrix, [{ op: 'move', from: '/1', path: '/3' }], [{ op: 'add', path: '/0', value: [] }])
      ).toEqual([{ op: 'add', path: '/0', value: [] }]);
      expect(
        transformPatch(matrix, [{ op: 'move', from: '/1', path: '/3' }], [{ op: 'add', path: '/1', value: [] }])
      ).toEqual([{ op: 'add', path: '/1', value: [] }]);
      expect(
        transformPatch(matrix, [{ op: 'move', from: '/1', path: '/3' }], [{ op: 'add', path: '/2', value: [] }])
      ).toEqual([{ op: 'add', path: '/1', value: [] }]);
      expect(
        transformPatch(matrix, [{ op: 'move', from: '/1', path: '/3' }], [{ op: 'add', path: '/3', value: [] }])
      ).toEqual([{ op: 'add', path: '/3', value: [] }]);
      expect(
        transformPatch(matrix, [{ op: 'move', from: '/1', path: '/3' }], [{ op: 'add', path: '/4', value: [] }])
      ).toEqual([{ op: 'add', path: '/4', value: [] }]);

      expect(
        transformPatch(matrix, [{ op: 'add', path: '/0', value: [] }], [{ op: 'move', from: '/1', path: '/3' }])
      ).toEqual([{ op: 'move', from: '/2', path: '/4' }]);
      expect(
        transformPatch(matrix, [{ op: 'add', path: '/1', value: [] }], [{ op: 'move', from: '/1', path: '/3' }])
      ).toEqual([{ op: 'move', from: '/2', path: '/4' }]);
      expect(
        transformPatch(matrix, [{ op: 'add', path: '/2', value: [] }], [{ op: 'move', from: '/1', path: '/3' }])
      ).toEqual([{ op: 'move', from: '/1', path: '/4' }]);
      expect(
        transformPatch(matrix, [{ op: 'add', path: '/3', value: [] }], [{ op: 'move', from: '/1', path: '/3' }])
      ).toEqual([{ op: 'move', from: '/1', path: '/4' }]);
      expect(
        transformPatch(matrix, [{ op: 'add', path: '/4', value: [] }], [{ op: 'move', from: '/1', path: '/3' }])
      ).toEqual([{ op: 'move', from: '/1', path: '/3' }]);

      expect(
        transformPatch(matrix, [{ op: 'move', from: '/1', path: '/2' }], [{ op: 'add', path: '/0', value: [] }])
      ).toEqual([{ op: 'add', path: '/0', value: [] }]);
      expect(
        transformPatch(matrix, [{ op: 'move', from: '/1', path: '/2' }], [{ op: 'add', path: '/1', value: [] }])
      ).toEqual([{ op: 'add', path: '/1', value: [] }]);
      expect(
        transformPatch(matrix, [{ op: 'move', from: '/1', path: '/2' }], [{ op: 'add', path: '/2', value: [] }])
      ).toEqual([{ op: 'add', path: '/2', value: [] }]);
      expect(
        transformPatch(matrix, [{ op: 'move', from: '/1', path: '/2' }], [{ op: 'add', path: '/3', value: [] }])
      ).toEqual([{ op: 'add', path: '/3', value: [] }]);

      expect(
        transformPatch(matrix, [{ op: 'move', from: '/3', path: '/1' }], [{ op: 'add', path: '/0', value: [] }])
      ).toEqual([{ op: 'add', path: '/0', value: [] }]);
      expect(
        transformPatch(matrix, [{ op: 'move', from: '/3', path: '/1' }], [{ op: 'add', path: '/1', value: [] }])
      ).toEqual([{ op: 'add', path: '/1', value: [] }]);
      expect(
        transformPatch(matrix, [{ op: 'move', from: '/3', path: '/1' }], [{ op: 'add', path: '/2', value: [] }])
      ).toEqual([{ op: 'add', path: '/3', value: [] }]);
      expect(
        transformPatch(matrix, [{ op: 'move', from: '/3', path: '/1' }], [{ op: 'add', path: '/3', value: [] }])
      ).toEqual([{ op: 'add', path: '/4', value: [] }]);
      expect(
        transformPatch(matrix, [{ op: 'move', from: '/3', path: '/1' }], [{ op: 'add', path: '/4', value: [] }])
      ).toEqual([{ op: 'add', path: '/4', value: [] }]);

      expect(
        transformPatch(matrix, [{ op: 'add', path: '/0', value: [] }], [{ op: 'move', from: '/3', path: '/1' }])
      ).toEqual([{ op: 'move', from: '/4', path: '/2' }]);
      expect(
        transformPatch(matrix, [{ op: 'add', path: '/1', value: [] }], [{ op: 'move', from: '/3', path: '/1' }])
      ).toEqual([{ op: 'move', from: '/4', path: '/1' }]);
      expect(
        transformPatch(matrix, [{ op: 'add', path: '/2', value: [] }], [{ op: 'move', from: '/3', path: '/1' }])
      ).toEqual([{ op: 'move', from: '/4', path: '/1' }]);
      expect(
        transformPatch(matrix, [{ op: 'add', path: '/3', value: [] }], [{ op: 'move', from: '/3', path: '/1' }])
      ).toEqual([{ op: 'move', from: '/4', path: '/1' }]);
      expect(
        transformPatch(matrix, [{ op: 'add', path: '/4', value: [] }], [{ op: 'move', from: '/3', path: '/1' }])
      ).toEqual([{ op: 'move', from: '/3', path: '/1' }]);

      expect(
        transformPatch(matrix, [{ op: 'move', from: '/2', path: '/1' }], [{ op: 'add', path: '/0', value: [] }])
      ).toEqual([{ op: 'add', path: '/0', value: [] }]);
      expect(
        transformPatch(matrix, [{ op: 'move', from: '/2', path: '/1' }], [{ op: 'add', path: '/1', value: [] }])
      ).toEqual([{ op: 'add', path: '/1', value: [] }]);
      expect(
        transformPatch(matrix, [{ op: 'move', from: '/2', path: '/1' }], [{ op: 'add', path: '/2', value: [] }])
      ).toEqual([{ op: 'add', path: '/3', value: [] }]);
      expect(
        transformPatch(matrix, [{ op: 'move', from: '/2', path: '/1' }], [{ op: 'add', path: '/3', value: [] }])
      ).toEqual([{ op: 'add', path: '/3', value: [] }]);
    });
  });

  describe('object', () => {
    it('Ops on deleted elements become noops', () => {
      expect(
        transformPatch(matrix, [{ op: 'remove', path: '/1' }], [{ op: 'add', path: '/1/0', value: 'hi' }])
      ).toEqual([]);
      expect(transformPatch(arr, [{ op: 'remove', path: '/1' }], [{ op: '@txt', path: '/1/text' }])).toEqual([]);
    });

    it('Ops on replaced elements become noops', () => {
      expect(
        transformPatch(matrix, [{ op: 'replace', path: '/1', value: 'y' }], [{ op: 'add', path: '/1/0', value: 'hi' }])
      ).toEqual([]);
      expect(
        transformPatch(arr, [{ op: 'replace', path: '/1', value: 'y' }], [{ op: '@txt', path: '/1/text' }])
      ).toEqual([]);
    });

    it('If two inserts are simultaneous, the last insert will win', () => {
      expect(
        transformPatch(obj, [{ op: 'add', path: '/x', value: 'b' }], [{ op: 'add', path: '/x', value: 'a' }])
      ).toEqual([{ op: 'add', path: '/x', value: 'a' }]);
      expect(
        transformPatch(obj, [{ op: 'add', path: '/x', value: 'b' }], [{ op: 'replace', path: '/x', value: 'a' }])
      ).toEqual([{ op: 'replace', path: '/x', value: 'a' }]);
    });

    it('parallel ops on different keys miss each other', () => {
      expect(
        transformPatch(obj, [{ op: 'add', path: '/b', value: 'z' }], [{ op: 'add', path: '/a', value: 'x' }])
      ).toEqual([{ op: 'add', path: '/a', value: 'x' }]);
      expect(transformPatch(obj, [{ op: 'remove', path: '/b' }], [{ op: 'add', path: '/a', value: 'x' }])).toEqual([
        { op: 'add', path: '/a', value: 'x' },
      ]);
      expect(transformPatch(obj, [{ op: 'remove', path: '/and' }], [{ op: 'add', path: '/in/he', value: {} }])).toEqual(
        [{ op: 'add', path: '/in/he', value: {} }]
      );
      expect(
        transformPatch(obj, [{ op: 'replace', path: '/y', value: 1 }], [{ op: 'add', path: '/x/0', value: 'his ' }])
      ).toEqual([{ op: 'add', path: '/x/0', value: 'his ' }]);
      expect(transformPatch(obj, [{ op: 'replace', path: '/y', value: 1 }], [{ op: '@txt', path: '/x' }])).toEqual([
        { op: '@txt', path: '/x' },
      ]);
    });

    it('replacement vs. deletion', () => {
      expect(transformPatch(obj, [{ op: 'remove', path: '/' }], [{ op: 'add', path: '/', value: {} }])).toEqual([
        { op: 'add', path: '/', value: {} },
      ]);
      expect(transformPatch(obj, [{ op: 'remove', path: '/' }], [{ op: 'replace', path: '/', value: {} }])).toEqual([
        { op: 'replace', path: '/', value: {} },
      ]);
    });

    it('replacement vs. replacement', () => {
      expect(
        transformPatch(
          obj,
          [
            { op: 'remove', path: '/' },
            { op: 'add', path: '/', value: null },
          ],
          [
            { op: 'remove', path: '/' },
            { op: 'replace', path: '/', value: {} },
          ]
        )
      ).toEqual([{ op: 'replace', path: '/', value: {} }]);
      expect(
        transformPatch(
          obj,
          [
            { op: 'remove', path: '/' },
            { op: 'add', path: '/', value: null },
          ],
          [
            { op: 'remove', path: '/' },
            { op: 'add', path: '/', value: {} },
          ]
        )
      ).toEqual([{ op: 'add', path: '/', value: {} }]);
      expect(
        transformPatch(obj, [{ op: 'replace', path: '/', value: null }], [{ op: 'replace', path: '/', value: {} }])
      ).toEqual([{ op: 'replace', path: '/', value: {} }]);
    });

    it('move, remove', () => {
      expect(
        transformPatch(obj, [{ op: 'move', from: '/x', path: '/y' }], [{ op: 'add', path: '/x', value: true }])
      ).toEqual([{ op: 'add', path: '/x', value: true }]);
      expect(
        transformPatch(obj, [{ op: 'move', from: '/x', path: '/y' }], [{ op: 'add', path: '/x/y', value: true }])
      ).toEqual([{ op: 'add', path: '/y/y', value: true }]);
      expect(
        transformPatch(
          obj,
          [{ op: 'move', from: '/x', path: '/y' }],
          [
            { op: 'remove', path: '/x' },
            { op: 'add', path: '/x', value: true },
          ]
        )
      ).toEqual([
        { op: 'remove', path: '/y' },
        { op: 'add', path: '/x', value: true },
      ]);
      expect(
        transformPatch(
          obj,
          [
            { op: 'move', from: '/x', path: '/y' },
            { op: 'move', from: '/y', path: '/z' },
          ],
          [{ op: 'move', from: '/x/a', path: '/x/b' }]
        )
      ).toEqual([{ op: 'move', from: '/z/a', path: '/z/b' }]);
    });

    it('copy', () => {
      expect(
        transformPatch(obj, [{ op: 'copy', from: '/y', path: '/x' }], [{ op: 'add', path: '/x/y', value: true }])
      ).toEqual([]);
    });

    it('An attempt to re-delete a key becomes a no-op', () => {
      expect(transformPatch(obj, [{ op: 'remove', path: '/k' }], [{ op: 'remove', path: '/k' }])).toEqual([]);
    });

    it('Ops after an add, copy, or move will not be affected by a change', () => {
      expect(
        transformPatch(
          obj,
          [{ op: 'remove', path: '/k' }],
          [
            { op: 'add', path: '/k' },
            { op: 'replace', path: '/k/g', value: 2 },
          ]
        )
      ).toEqual([
        { op: 'add', path: '/k' },
        { op: 'replace', path: '/k/g', value: 2 },
      ]);
    });
  });

  describe('text', () => {
    it('applies text changes', () => {
      expect(
        transformPatch(
          obj,
          [{ op: '@txt', path: '/text', value: [{ insert: 'test' }] }],
          [{ op: '@txt', path: '/text', value: [{ insert: 'testing' }] }]
        )
      ).toEqual([{ op: '@txt', path: '/text', value: [{ retain: 4 }, { insert: 'testing' }] }]);
      expect(
        transformPatch(
          obj,
          [
            { op: '@txt', path: '/text', value: [{ insert: 'test' }] },
            { op: '@txt', path: '/text', value: [{ delete: 1 }, { insert: 'T' }] },
          ],
          [{ op: '@txt', path: '/text', value: [{ insert: 'testing' }] }]
        )
      ).toEqual([{ op: '@txt', path: '/text', value: [{ retain: 4 }, { insert: 'testing' }] }]);
      expect(
        transformPatch(
          obj,
          [{ op: '@txt', path: '/a', value: [{ insert: 'test' }] }],
          [{ op: '@txt', path: '/a/text', value: [{ insert: 'testing' }] }]
        )
      ).toEqual([]);
      expect(
        transformPatch(
          obj,
          [{ op: '@txt', path: '/text', value: [{ insert: 'test' }] }],
          [{ op: 'replace', path: '/text', value: true }]
        )
      ).toEqual([{ op: 'replace', path: '/text', value: true }]);
    });

    it('deletes values it overwrites', () => {
      expect(
        transformPatch(
          obj,
          [{ op: '@txt', path: '/x', value: [{ insert: 'test' }] }],
          [{ op: 'add', path: '/x/y', value: 1 }]
        )
      ).toEqual([]);
      expect(
        transformPatch(obj, [{ op: '@txt', path: '/x', value: [{ insert: 'test' }] }], [{ op: 'remove', path: '/x' }])
      ).toEqual([{ op: 'remove', path: '/x' }]);
      expect(
        transformPatch(
          obj,
          [{ op: '@txt', path: '/x', value: [{ insert: 'test' }] }],
          [{ op: 'replace', path: '/x', value: 10 }]
        )
      ).toEqual([{ op: 'replace', path: '/x', value: 10 }]);
    });
  });

  describe('unsupported', () => {
    it('noops', () => {
      expect(
        transformPatch(
          obj,
          [{ op: 'unsupported' as 'add', path: '/x', value: true }],
          [{ op: 'add', path: '/x', value: 1 }]
        )
      ).toEqual([{ op: 'add', path: '/x', value: 1 }]);
    });
  });
});
