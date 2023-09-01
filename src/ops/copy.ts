import type { JSONPatchOpHandler } from '../types';
import { isArrayPath, log, updateArrayIndexes, updateRemovedOps, updateSoftWrites } from '../utils';
import { getOpData } from '../utils/getOpData';
import { add } from './add';


export const copy: JSONPatchOpHandler = {
  like: 'copy',

  apply(path, _, from: string, createMissingObjects) {
    // eslint-disable-next-line no-unused-vars
    const [ keys, lastKey, target ] = getOpData(from);

    if (target === null) {
      return `[op:copy] path not found: ${from}`;
    }

    return add.apply(path, target[lastKey], '', createMissingObjects);
  },

  invert({ path }, value, changedObj, isIndex) {
    if (path.endsWith('/-')) return { op: 'remove', path: path.replace('-', changedObj.length) };
    else if (isIndex) return { op: 'remove', path };
    return (value === undefined ? { op: 'remove', path } : { op: 'replace', path, value });
  },

  transform(thisOp, otherOps) {
    log('Transforming', otherOps, 'against "add"', thisOp);

    if (isArrayPath(thisOp.path)) {
      // Adjust any operations on the same array by 1 to account for this new entry
      return updateArrayIndexes(thisOp.path, otherOps, 1);
    } else if (thisOp.soft) {
      // Treat empty objects specially. If two empty objects are added to the same location, don't overwrite the existing
      // one, allowing for the merging of maps together
      return updateSoftWrites(thisOp.path, otherOps, thisOp.soft);
    } else {
      // Remove anything that was done at this path since it is being overwritten
      return updateRemovedOps(thisOp.path, otherOps);
    }
  }

};
