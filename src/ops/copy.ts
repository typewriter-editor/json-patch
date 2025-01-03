import type { JSONPatchOpHandler } from '../types.js';
import { getOpData } from '../utils/getOpData.js';
import { isArrayPath, log, updateArrayIndexes, updateRemovedOps } from '../utils/index.js';
import { add } from './add.js';

export const copy: JSONPatchOpHandler = {
  like: 'copy',

  apply(state, path, _, from: string, createMissingObjects) {
    // eslint-disable-next-line no-unused-vars
    const [keys, lastKey, target] = getOpData(state, from);

    if (target === null) {
      return `[op:copy] path not found: ${from}`;
    }

    return add.apply(state, path, target[lastKey], '', createMissingObjects);
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
    } else {
      // Remove anything that was done at this path since it is being overwritten
      return updateRemovedOps(state, thisOp.path, otherOps);
    }
  },
};
