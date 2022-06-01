import { exit } from './apply/utils/exit';
import type { ApplyJSONPatchOptions, JSONPatchCustomTypes, JSONPatchOp } from './types';
import { patchWith, root } from './apply/state';
import * as ops from './apply/ops';
import { ApplyHandler } from '.';
import { getLWW } from './lww';



export function applyPatch(object: any, patches: JSONPatchOp[], opts: ApplyJSONPatchOptions = {}, types: JSONPatchCustomTypes = {}) {
  if (patches.length === 0) {
    return object;
  }
  if (opts.atPath) {
    patches = patches.map(op => ({ ...op, path: opts.atPath + op.path }));
  }
  const timestamp = opts.timestamp || 0;
  const lww = timestamp ? getLWW(object.$lww$) : null;

  return patchWith(object, patches.length > 1, () => {
    for (let i = 0, imax = patches.length; i < imax; i++) {
      const patch = patches[i];
      if (lww) {
        if (patch.op !== 'add' && patch.op !== 'remove' && patch.op !== 'replace') {
          throw new Error('Last write wins only works with add, remove and replace operations');
        }
        if (lww.get(patch.path) > timestamp) continue;
      }
      const handler = types[patch.op]?.apply || (ops as {[name: string]: ApplyHandler})[patch.op];
      const error = handler ? handler('' + patch.path, patch.value, '' + patch.from) : `[op:${patch.op}] unknown`;
      if (error) {
        if (!opts.silent) console.error(error, patch);
        if (opts.strict) throw new TypeError(error);
        if (opts.rigid) return exit(object, patch, opts);
      } else if (lww) {
        lww.set(patch.path, timestamp);
      }
    }
    if (lww && root && root[''] && root[''] !== object && typeof root[''] === 'object' && !Array.isArray(root[''])) {
      (root as any)[''].$lww$ = lww.toJSON();
    }
  });
}
