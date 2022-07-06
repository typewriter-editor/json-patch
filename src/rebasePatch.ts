/*!
 * Based on work from
 * https://github.com/Palindrom/JSONPatchOT
 * (c) 2017 Tomek Wytrebowicz
 *
 * MIT license
 * (c) 2022 Jacob Wright
 *
 *
 * NOTE: using /array/- syntax to indicate the end of the array makes it impossible to rebase arrays correctly in all
 */

import type { JSONPatchCustomTypes, JSONPatchOp } from './types';
import { filterNoops } from './rebase/utils/ops';
import * as rebases from './rebase/ops';
import { log } from './rebase/utils/log';
import { RebaseHandler } from '.';
import { patchWith } from './apply/state';


/**
 * Transform an array of JSON Patch operations against another array of JSON Patch operations. Returns a new array with
 * rebased operations. Operations that do not change are left, while operations that do change are cloned, making the
 * results of this function immutable.
 */
export function rebasePatch(ops: JSONPatchOp[], overOps: JSONPatchOp[], types: JSONPatchCustomTypes = {}, object?: any): JSONPatchOp[] {
  return patchWith(object, false, () => {
    return overOps.reduce((ops: JSONPatchOp[], over: JSONPatchOp) => {
      // rebase ops with patch operation
      const handler = types[over.op]?.rebase || (rebases as {[name: string]: RebaseHandler})[over.op];
      if (typeof handler === 'function') {
        ops = handler(over, ops);
      } else {
        log('No function to rebase against for', over.op);
      }

      return ops;
    }, filterNoops(ops));
  });
}
