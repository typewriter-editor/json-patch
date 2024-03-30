import type { JSONPatchOpHandler } from '../types';
import { get, updateRemovedOps } from '../utils';
import { replace } from './replace';

/**
 * Custom types should start with an @ symbol, so you can use this in this way:
 * ```js
 * import { increment } from '@json-patch/custom-types/increment';
 *
 * const patch = new JSONPatch([], { '@inc': increment });
 * ```
 *
 * Or you can subclass JSONPatch:
 * ```js
 * class MyJSONPatch extends JSONPatch {
 *   constructor(ops: JSONPatchOp[]) {
 *     super(ops, { '@inc': increment });
 *   }
 *
 *   increment(path: string, value: number) {
 *     return this.op('@inc', path, value);
 *   }
 *
 *   decrement(path: string, value: number) {
 *     return this.op('@inc', path, -value);
 *   }
 * }
 */
export const increment: JSONPatchOpHandler = {
  like: 'replace',

  apply(state, path, value, _, createMissingObjects) {
    return replace.apply(state, path, (get(state, path) || 0) + value, '', createMissingObjects);
  },
  transform(state, thisOp, otherOps) {
    return updateRemovedOps(state, thisOp.path, otherOps, false, true);
  },
  invert(state, op, value, changedObj, isIndex) {
    return replace.invert(state, op, value, changedObj, isIndex);
  },
  compose(state, value1, value2) {
    return value1 + value2;
  },
}
