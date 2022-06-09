import { exit } from './apply/utils/exit';
import type { ApplyHandler, ApplyJSONPatchOptions, JSONPatchCustomTypes, JSONPatchOp } from './types';
import { patchWith } from './apply/state';
import * as ops from './apply/ops';


export function applyPatch(object: any, patches: JSONPatchOp[], opts: ApplyJSONPatchOptions = {}, types: JSONPatchCustomTypes = {}) {
  if (patches.length === 0) {
    return object;
  }
  if (opts.atPath) {
    patches = patches.map(op => ({ ...op, path: opts.atPath + op.path }));
  }

  return patchWith(object, patches.length > 1, () => {
    for (let i = 0, imax = patches.length; i < imax; i++) {
      const patch = patches[i];
      const handler = types[patch.op]?.apply || (ops as {[name: string]: ApplyHandler})[patch.op];
      const error = handler ? handler('' + patch.path, patch.value, '' + patch.from) : `[op:${patch.op}] unknown`;
      if (error) {
        if (!opts.silent) console.error(error, patch);
        if (opts.strict) throw new TypeError(error);
        if (opts.rigid) return exit(object, patch, opts);
      }
    }
  });
}
