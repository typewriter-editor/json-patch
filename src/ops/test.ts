import type { JSONPatchOp, JSONPatchOpHandler } from '../types.js';
import { deepEqual } from '../utils/deepEqual.js';
import { getOpData } from '../utils/getOpData.js';

export const test: JSONPatchOpHandler = {
  like: 'test',

  apply(state, path, expected) {
    // eslint-disable-next-line no-unused-vars
    const [keys, lastKey, target] = getOpData(state, path);

    if (target === null) {
      return `[op:test] path not found: ${path}`;
    }

    if (!deepEqual(target[lastKey], expected)) {
      const a = JSON.stringify(target[lastKey]);
      const b = JSON.stringify(expected);

      return `[op:test] not matched: ${a} ${b}`;
    }
  },

  invert() {
    return undefined as any as JSONPatchOp;
  },

  transform(state, other, ops) {
    return ops;
  },
};
