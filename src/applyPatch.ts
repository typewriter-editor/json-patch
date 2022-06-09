import { exit } from './apply/utils/exit';
import type { ApplyJSONPatchOptions, JSONPatchCustomTypes, JSONPatchOp } from './types';
import { patchWith, root } from './apply/state';
import * as ops from './apply/ops';
import { ApplyHandler } from '.';
import { getLWW, LWW } from './lww';
import { isArrayPath } from './rebase/utils';
import { getOpData } from './apply/utils';



export function applyPatch(object: any, patches: JSONPatchOp[], opts: ApplyJSONPatchOptions = {}, types: JSONPatchCustomTypes = {}) {
  if (patches.length === 0) {
    return object;
  }
  if (opts.atPath) {
    patches = patches.map(op => ({ ...op, path: opts.atPath + op.path }));
  }
  const timestamp = opts.ts || 0;
  let lww = timestamp ? getLWW(object) : null;

  return patchWith(object, patches.length > 1, () => {
    for (let i = 0, imax = patches.length; i < imax; i++) {
      const patch = patches[i];
      const ts = patch.ts || timestamp;
      if (ts) {
        if (patch.op !== 'add' && patch.op !== 'remove' && patch.op !== 'replace') {
          throw new Error('Last-write-wins only works with add, remove and replace operations');
        } else if (isArrayPath(patch.path) && Array.isArray(getOpData(patch.path)[2])) {
          throw new TypeError('Last-write-wins cannot be used with array entries');
        }
        if (!lww) lww = getLWW(object);
        if (lww.get(patch.path) > ts) continue;
      }
      const handler = types[patch.op]?.apply || (ops as {[name: string]: ApplyHandler})[patch.op];
      const error = handler ? handler('' + patch.path, patch.value, '' + patch.from) : `[op:${patch.op}] unknown`;
      if (error) {
        if (!opts.silent) console.error(error, patch);
        if (opts.strict) throw new TypeError(error);
        if (opts.rigid) return exit(object, patch, opts);
      } else if (lww && ts) {
        const exceptions = lww.set(patch.path, ts);
        for (let i = 0; i < exceptions.length; i++) {
          const patch = exceptions[i];
          (ops as {[name: string]: ApplyHandler})[patch.op](patch.path, patch.value, patch.from as string);
        }
      }
    }
    if (lww && root && root[''] && root[''] !== object && typeof root[''] === 'object' && !Array.isArray(root[''])) {
      (root as any)[''].$lww$ = lww.toJSON();
    }
  });
}
