import type { JSONPatchOp } from '../../types';
import { log } from './log';

/**
 * Check whether this operation is an add operation of some sort (add, copy, move).
 */
export function isAdd(op: JSONPatchOp, pathName: 'from' | 'path') {
  return (op.op === 'add' || op.op === 'copy' || op.op === 'move') && pathName === 'path';
}

/**
 * Filters an array, returning the original if there is no change.
 */
export function filterOps(ops: JSONPatchOp[], iterator: (op: JSONPatchOp) => any) {
  const filtered = ops.filter(iterator);
  return filtered.length === ops.length ? ops : filtered;
}

export function filterNoops(ops: JSONPatchOp[]) {
  return filterOps(ops, op => op && op.from !== op.path);
}

/**
 * Maps an array, returning the original if there is no change.
 */
export function mapOps(ops: JSONPatchOp[], iterator: (op: JSONPatchOp) => JSONPatchOp) {
  let changed = false;
  const mapped = ops.map(original => {
    let value = iterator(original);
    if (!changed && value !== original) changed = true;
    return value;
  });
  return changed ? mapped : ops;
}

/**
 * Remove operations that apply to a value which was removed.
 */
export function updateRemovedOps(overPath: string, ops: JSONPatchOp[], exceptions?: (op: JSONPatchOp) => any) {
  const pathPrefix = `${overPath}/`;
  let replaced = false;

  return filterNoops(mapOps(ops, op => {
    if (replaced) {
      return op;
    }
    if ((op.op === 'add' || op.op === 'copy' || op.op === 'move' || op.op === 'test') && overPath === op.path) {
      // Once an operation sets this value again, the following ops will be working on that and not the old value so
      // should be left alone
      replaced = op.op !== 'test';
      return op;
    }
    const path = op.from || op.path;
    if (path === overPath || path.indexOf(pathPrefix) === 0) {
      if (exceptions) {
        const exceptedOp = exceptions(op);
        if (exceptedOp) return exceptedOp;
      }
      log('Removing', op);
      return null;
    }
    return op;
  }));
}
