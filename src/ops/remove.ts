import type { JSONPatchOpHandler } from '../types';
import { log, transformRemove } from '../utils';
import { getOpData } from '../utils/getOpData';
import { pluckWithShallowCopy } from '../utils/pluck';
import { toArrayIndex } from '../utils/toArrayIndex';

export const remove: JSONPatchOpHandler = {
  like: 'remove',

  apply(state, path: string, value, _, createMissingObjects) {
    const [ keys, lastKey, target ] = getOpData(state, path);

    if (target === null) {
      if (createMissingObjects) return;
      return `[op:remove] path not found: ${path}`;
    }

    if (Array.isArray(target)) {
      const index = toArrayIndex(target, lastKey);
      if (target.length <= index) {
        return "[op:remove] invalid array index: " + path;
      }
      pluckWithShallowCopy(state, keys).splice(index, 1);
    } else {
      delete pluckWithShallowCopy(state, keys)[lastKey];
    }
  },

  invert(state, { path }, value) {
    return { op: 'add', path, value };
  },

  transform(state, thisOp, otherOps) {
    log('Transforming', otherOps, 'against "remove"', thisOp);
    return transformRemove(state, thisOp.path, otherOps, true);
  }
}
