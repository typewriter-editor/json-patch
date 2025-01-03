import type { JSONPatchOpHandler } from '../types.js';
import { deepEqual } from '../utils/deepEqual.js';
import { getOpData } from '../utils/getOpData.js';
import {
  isArrayPath,
  isEmptyObject,
  log,
  updateArrayIndexes,
  updateRemovedOps,
  updateSoftWrites,
} from '../utils/index.js';
import { pluckWithShallowCopy } from '../utils/pluck.js';
import { toArrayIndex } from '../utils/toArrayIndex.js';

export const add: JSONPatchOpHandler = {
  like: 'add',

  apply(state, path, value, _, createMissingObjects) {
    if (typeof value === 'undefined') {
      return '[op:add] require value, but got undefined';
    }
    const [keys, lastKey, target] = getOpData(state, path, createMissingObjects);

    if (target === null) {
      return `[op:add] path not found: ${path}`;
    }

    if (Array.isArray(target)) {
      const index = toArrayIndex(target, lastKey);
      if (target.length < index) {
        return `[op:add] invalid array index: ${path}`;
      }
      pluckWithShallowCopy(state, keys, createMissingObjects).splice(index, 0, value);
    } else {
      if (!deepEqual(target[lastKey], value)) {
        pluckWithShallowCopy(state, keys, createMissingObjects)[lastKey] = value;
      }
    }
  },

  invert(state, { path }, value, changedObj, isIndex) {
    if (path.endsWith('/-')) return { op: 'remove', path: path.replace('-', changedObj.length) };
    else if (isIndex) return { op: 'remove', path };
    return value === undefined ? { op: 'remove', path } : { op: 'replace', path, value };
  },

  transform(state, thisOp, otherOps) {
    log('Transforming', otherOps, 'against "add"', thisOp);

    if (isArrayPath(thisOp.path, state)) {
      // Adjust any operations on the same array by 1 to account for this new entry
      return updateArrayIndexes(state, thisOp.path, otherOps, 1);
    } else if (isEmptyObject(thisOp.value)) {
      // Treat empty objects special. If two empty objects are added to the same location, don't overwrite the existing
      // one, allowing for the merging of maps together which did not exist before
      return updateSoftWrites(thisOp.path, otherOps);
    } else {
      // Remove anything that was done at this path since it is being overwritten by the add
      return updateRemovedOps(state, thisOp.path, otherOps);
    }
  },
};
