import { api } from './utils/api';
import { exit } from './utils/exit';
import { toBoolean } from './utils/toBoolean';
import { throwException } from './utils/throwException';
import type { ApplyJSONPatchOptions, JSONPatchOp } from './types';
import { patchWith } from './state';
import { ops } from './ops';



export function applyPatch(object: any, patches: JSONPatchOp[], opts: ApplyJSONPatchOptions = {}) {
  if (patches.length === 0) {
    return object;
  }

  const hasError = opts.strict ? throwException : toBoolean;

  return patchWith(object, patches.length > 1, () => {
    for (let i = 0, imax = patches.length; i < imax; i++) {
      const patch = patches[i];
      if (patch.op in ops) {
        const handler = ops[patch.op];
        if (hasError(handler('' + patch.path, patch.value, '' + patch.from))) {
          return exit(object, patch, opts);
        }
      } else if (opts.custom && opts.custom[patch.op]) {
        if (hasError(opts.custom[patch.op](api, patch, i, patches))) {
          return exit(object, patch, opts);
        }
      } else {
        hasError(`[op:${patch.op}] unknown`);
        return exit(object, patch, opts);
      }
    }
  });
}
