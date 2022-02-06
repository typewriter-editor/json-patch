import { exit } from './apply/utils/exit';
import { toBoolean } from './apply/utils/toBoolean';
import { throwException } from './apply/utils/throwException';
import type { ApplyJSONPatchOptions, JSONPatchCustomTypes, JSONPatchOp } from './types';
import { patchWith } from './apply/state';
import * as ops from './apply/ops';
import { ApplyHandler } from '.';



export function applyPatch(object: any, patches: JSONPatchOp[], opts: ApplyJSONPatchOptions = {}, types: JSONPatchCustomTypes = {}) {
  if (patches.length === 0) {
    return object;
  }
  if (opts.atPath) {
    patches = patches.map(op => ({ ...op, path: opts.atPath + op.path }));
  }

  const hasError = opts.strict ? throwException : toBoolean;

  return patchWith(object, patches.length > 1, () => {
    for (let i = 0, imax = patches.length; i < imax; i++) {
      const patch = patches[i];
      const handler = types[patch.op]?.apply || (ops as {[name: string]: ApplyHandler})[patch.op];
      if (handler) {
        if (hasError(handler('' + patch.path, patch.value, '' + patch.from))) {
          return exit(object, patch, opts);
        }
      } else {
        hasError(`[op:${patch.op}] unknown`);
        return exit(object, patch, opts);
      }
    }
  });
}
