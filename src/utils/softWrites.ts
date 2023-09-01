import type { JSONPatchOp } from '../types';
import { log } from './log';
import { mapAndFilterOps } from './ops';

export function isEmptyObject(value: any) {
  return Boolean(value && typeof value === 'object' && Object.keys(value).length === 0);
}

/**
 * If other objects were added to this same path, assume they are maps/hashes/lookups and don't overwrite, allow
 * subsequent ops to merge onto the first map created. `soft` will also do this for any value that already exists.
 */
 export function updateSoftWrites(overPath: string, ops: JSONPatchOp[], explicit?: boolean) {
  return mapAndFilterOps(ops, op => {
    if (explicit) {
      if (op.soft && op.path === overPath) {
        log('Removing soft object write', op);
        return null as any as JSONPatchOp;
      }
    } else if (op.op === 'add' && op.path === overPath && isEmptyObject(op.value)) {
      log('Removing empty object', op);
      return null as any as JSONPatchOp;
    }
    return op;
  });
}
