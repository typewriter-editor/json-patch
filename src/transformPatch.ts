/*!
 * Based on work from
 * https://github.com/Palindrom/JSONPatchOT
 * (c) 2017 Tomek Wytrebowicz
 *
 * MIT license
 * (c) 2022 Jacob Wright
 *
 *
 * WARNING: using /array/- syntax to indicate the end of the array makes it impossible to transform arrays correctly in
 * all situaions. Please avoid using this syntax when using Operational Transformations.
 */

import type { JSONPatchCustomTypes, JSONPatchOp, TransformHandler } from './types';
import * as transforms from './transform/ops';
import { log } from './transform/utils/log';
import { patchWith } from './apply/state';


/**
 * Transform an array of JSON Patch operations against another array of JSON Patch operations. Returns a new array with
 * transformed operations. Operations that do not change are left, while operations that do change are cloned, making the
 * results of this function immutable.
 */
export function transformPatch(obj: any, ops: JSONPatchOp[], overOps: JSONPatchOp[], priority = false, types: JSONPatchCustomTypes = {}): JSONPatchOp[] {
  return patchWith(obj, false, () => {
    return overOps.reduce((ops: JSONPatchOp[], other: JSONPatchOp) => {
      // transform ops with patch operation
      const handler = types[other.op]?.transform || (transforms as {[name: string]: TransformHandler})[other.op];
      if (typeof handler === 'function') {
        ops = handler(other, ops, priority);
      } else {
        log('No function to transform against for', other.op);
      }

      return ops;
    }, ops);
  });
}
