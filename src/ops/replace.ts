import type { JSONPatchOpHandler } from '../types';
import { log, updateRemovedOps } from '../utils';
import { deepEqual } from '../utils/deepEqual';
import { getOpData } from '../utils/getOpData';
import { pluckWithShallowCopy } from '../utils/pluck';
import { toArrayIndex } from '../utils/toArrayIndex';

export const replace: JSONPatchOpHandler = {
  like: 'replace',

  apply(state, path, value, _, createMissingObjects) {
    if (typeof value === 'undefined') {
      return '[op:replace] require value, but got undefined';
    }
    const [ keys, lastKey, target ] = getOpData(state, path, createMissingObjects);

    if (target === null) {
      return `[op:replace] path not found: ${path}`;
    }

    if (Array.isArray(target)) {
      const index = toArrayIndex(target, lastKey);
      if (target.length <= index) {
        return `[op:replace] invalid array index: ${path}`;
      }
      if (!deepEqual(target[index], value)) {
        pluckWithShallowCopy(state, keys, createMissingObjects).splice(index, 1, value);
      }
    } else {
      if (!deepEqual(target[lastKey], value)) {
        pluckWithShallowCopy(state, keys, createMissingObjects)[lastKey] = value;
      }
    }
  },

  invert(state, { path }, value, changedObj) {
    if (path.endsWith('/-')) path = path.replace('-', changedObj.length);
    return value === undefined ? { op: 'remove', path } : { op: 'replace', path, value };
  },

  transform(state, thisOp, otherOps) {
    log('Transforming ', otherOps,' against "replace"', thisOp);
    return updateRemovedOps(state, thisOp.path, otherOps);
  },

  compose(state, value1, value2) {
    return value2;
  }
};
