import type { JSONPatchOpHandler } from '../types';
import { isArrayPath, log, updateArrayIndexes, updateRemovedOps } from '../utils';
import { getOpData } from '../utils/getOpData';
import { pluckWithShallowCopy } from '../utils/pluck';
import { toArrayIndex } from '../utils/toArrayIndex';

export const remove: JSONPatchOpHandler = {

  apply(path: string) {
    const [ keys, lastKey, target ] = getOpData(path);

    if (target === null) {
      return `[op:remove] path not found: ${path}`;
    }

    if (Array.isArray(target)) {
      const index = toArrayIndex(target, lastKey);
      if (target.length <= index) {
        return "[op:remove] invalid array index: " + path;
      }
      pluckWithShallowCopy(keys).splice(index, 1);
    } else {
      delete pluckWithShallowCopy(keys)[lastKey];
    }
  },

  invert({ path }, value) {
    return { op: 'add', path, value };
  },

  transform(other, ops, priority) {
    log('Transforming', ops, 'against "remove"', other);
    if (isArrayPath(other.path)) {
      return updateArrayIndexes(other.path, ops, -1, priority);
    } else {
      return updateRemovedOps(other.path, ops, priority);
    }
  }
}
