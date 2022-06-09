import { applyOps, invertOps, rebaseOps } from '..';
import type { JSONPatchCustomType } from '../types';

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
export const increment: JSONPatchCustomType = {
  apply: (path, value) => {
    return applyOps.replace(path, (applyOps.get(path) || 0) + value);
  },
  rebase: (over, ops) => {
    return rebaseOps.replace(over, ops);
  },
  invert: (op, value, changedObj) => {
    return invertOps.replace(op, value, changedObj);
  }
}
