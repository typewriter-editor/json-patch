import type { JSONPatchOp } from '../types';
import { getTypeLike } from './getType';
import { log } from './log';

/**
 * Check whether this operation is an add operation of some sort (add, copy, move).
 */
export function isAdd(op: JSONPatchOp, pathName: 'from' | 'path') {
  const like = getTypeLike(op);
  return (like === 'add' || like === 'copy' || like === 'move') && pathName === 'path';
}

/**
 * Transforms an array of ops, returning the original if there is no change, filtering out ops that are dropped.
 */
export function mapAndFilterOps(ops: JSONPatchOp[], iterator: (op: JSONPatchOp) => JSONPatchOp | [JSONPatchOp,JSONPatchOp] | null) {
  let changed = false;
  const mapped: JSONPatchOp[] = [];
  for (let i = 0; i < ops.length; i++) {
    const original = ops[i];
    // If an op was copied or moved to the same path, it is a no-op and should be removed
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
export function updateRemovedOps(thisPath: string, otherOps: JSONPatchOp[], updatableObject = false, opOp?: string, customHandler?: (op: JSONPatchOp) => any) {
  const pathPrefix = `${thisPath}/`;
  let replaced = false;

  return mapAndFilterOps(otherOps, op => {
    if (replaced) return op;
    const like = getTypeLike(op);
    const canMergeCustom = customHandler && opOp === op.op;

    if (thisPath === op.path && like !== 'remove' && !canMergeCustom) {
      // Once an operation sets this value again, we can assume the following ops were working on that and not the
      // old value so they can be kept
      replaced = op.op !== 'test';
      return op;
    }

    const { path, from } = op;
    if (path === thisPath && canMergeCustom) {
      const customOp = customHandler(op);
      if (customOp) return customOp;
    }

    const samePath = !updatableObject && path === thisPath || path.startsWith(pathPrefix);
    const sameFrom = !updatableObject && from === thisPath || from?.startsWith(pathPrefix);
    if (samePath || sameFrom) {
      log('Removing', op);
      return null;
    }
    return op;
  });
}
