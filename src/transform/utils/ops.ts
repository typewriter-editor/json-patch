import type { JSONPatchOp } from '../../types';
import { log } from './log';

/**
 * Check whether this operation is an add operation of some sort (add, copy, move).
 */
export function isAdd(op: JSONPatchOp, pathName: 'from' | 'path') {
  return (op.op === 'add' || op.op === 'copy' || op.op === 'move') && pathName === 'path';
}

export function isReplace(op: JSONPatchOp) {
  return op.op === 'replace' || op.op[0] === '@';
}

/**
 * Maps an array, returning the original if there is no change.
 */
export function transformPatchOps(ops: JSONPatchOp[], iterator: (op: JSONPatchOp) => JSONPatchOp | [JSONPatchOp,JSONPatchOp] | null) {
  let changed = false;
  const mapped: JSONPatchOp[] = [];
  for (let i = 0; i < ops.length; i++) {
    const original = ops[i];
    if (original.from === original.path) {
      if (!changed) changed = true;
      continue;
    }
    let value = iterator(original);
    if (value && !Array.isArray(value) && value.from === value.path) value = null;
    if (!changed && value !== original) changed = true;
    if (Array.isArray(value)) mapped.push(...value);
    else if (value) mapped.push(value);
  }
  return changed ? mapped : ops;
}

/**
 * Remove operations that apply to a value which was removed.
 */
export function updateRemovedOps(otherPath: string, ops: JSONPatchOp[], priority: boolean, customHandler?: (op: JSONPatchOp) => any) {
  const pathPrefix = `${otherPath}/`;
  let replaced = false;

  return transformPatchOps(ops, op => {
    if (replaced) {
      return op;
    }
    if (otherPath === op.path && ignorableByRemoves(op, priority)) {
      // Once an operation sets this value again, we can assume the following ops were working on that and not the
      // old value so they can be kept
      replaced = op.op !== 'test';
      return op;
    }
    const path = op.from || op.path;
    if (path === otherPath || path.startsWith(pathPrefix)) {
      if (customHandler) {
        const customOp = customHandler(op);
        if (customOp) return customOp;
      }
      log('Removing', op);
      return null;
    }
    return op;
  });
}

function ignorableByRemoves(op: JSONPatchOp, priority: boolean) {
  if (!priority && op.op === 'replace') return true;
  return op.op === 'add' || op.op === 'copy' || op.op === 'move' || op.op === 'test';
}

