import type { JSONPatchOp } from '../../types';
import { isArrayPath } from '../utils/isArrayPath';
import { log } from '../utils/log';
import { filterNoops, isAdd, mapOps, updateRemovedOps } from '../utils/ops';
import { getPrefix, getProp, getPropAfter } from '../utils/paths';
import { updateArrayIndexes } from '../utils/updateArrayIndexes';

export function move(over: JSONPatchOp, ops: JSONPatchOp[]) {
  log('Rebasing', ops, 'over "move"', over);
  let removed = false;
  const { from, path } = over as { from: string, path: string };

  /*
  A move needs to do a "remove" and an "add" at once with `from` and `path`. If it is being moved from one location in
  an array to another in the same array, this needs to be handled special.

  1. Ops that were added to where the move lands when not an array, should be removed just like with an add/copy
  2. Ops that were added to where the move came from should be translated to the new path
  3. Ops that are in an array with the moved item before or after need to be adjusted up or down
    3a. But, ops that were translated to the new path, shouldn't get adjusted up or down by these adjustments
  */

  // A move removes the value from one place then adds it to another, update the paths and add a marker to them so
  // they won't be altered by `updateArrayIndexes`, then remove the markers afterwards
  ops = mapOps(ops, op => {
    if (removed) {
      return op;
    }
    if (op.op === 'remove' && from === op.path) {
      // Once an operation removes the moved value, the following ops should be working on the old location and not
      // not the new one. Allow the following operations (which may include add/remove) to affect the old location
      removed = true;
    }
    const original = op;
    op = updateMovePath(op, 'path', from, path, original);
    op = updateMovePath(op, 'from', from, path, original);
    return op;
  });

  // Remove/adjust items that were affected by this item moving (those that actually moved because of it will not
  // be affected because they have a temporary $ marker prefix that will keep them from doing so)
  if (from === path) {
    // do nothing
  } else if (isArrayPath(from) && isArrayPath(path) && getPrefix(from) === getPrefix(path)) {
    // need special logic when a move is within one array
    ops = updateArrayIndexesForMove(from, path, ops);
  } else {
    // if a move is not within one array, treat it as a remove then add
    if (isArrayPath(from)) {
      ops = updateArrayIndexes(from, ops, -1);
    } else {
      ops = updateRemovedOps(from, ops);
    }

    if (isArrayPath(path)) {
      ops = updateArrayIndexes(path, ops, 1);
    } else {
      ops = updateRemovedOps(path, ops);
    }
  }

  // Remove the move markers added with `updateMovePath`
  ops.forEach(removeMoveMarkers);
  return ops;
}


/**
 * Update paths for a move operation, adding a marker so the path will not be altered by array updates.
 */
 function updateMovePath(op: JSONPatchOp, pathName: 'from' | 'path', from: string, to: string, original: JSONPatchOp): JSONPatchOp {
  const path = op[pathName];
  if (!path) return op; // No adjustment needed on a property that doesn't exist

  // If a value is being added or copied to the old location should it be adjusted? Certainly not if it is an array
  if (isAdd(op, pathName) && op.path === from && isArrayPath(from)) {
    return op;
  }

  // If this path needs to be changed due to a move operation, change it, but prefix it with a $ temporarily so when we
  // adjust the array indexes to account for this change, we aren't changing this path we JUST set. We will remove the
  // $ prefix right after we adjust arrays affected by this move.
  if (path === from || path.indexOf(from + '/') === 0) {
    if (op === original) op = Object.assign({}, op);
    log('Moving', op, 'from', from, 'to', to);
    // Add a marker "$" so this path will not be double-updated by array index updates
    op[pathName] = '$' + path.replace(from, to);
  }

  return op;
}


/**
 * Update array indexes to account for values being added or removed from an array. If the path is not an array index
 * or if nothing is changed then the original array is returned.
 */
function updateArrayIndexesForMove(overFrom: string, overPath: string, ops: JSONPatchOp[]) {
  const fromIndex = parseInt(getProp(overFrom));
  const pathIndex = parseInt(getProp(overPath));
  const prefix = getPrefix(overFrom);

  // Check ops for any that need to be replaced
  log('Shifting array indexes for a move between', overFrom, 'and', overPath);

  return filterNoops(mapOps(ops, op => {
    const original = op;
    // check for items from the same array that will be affected
    op = updateArrayPathForMove(op, 'from', prefix, fromIndex, pathIndex, original);
    return op && updateArrayPathForMove(op, 'path', prefix, fromIndex, pathIndex, original);
  }));
}


/**
 * Get the adjusted path if it is higher, or undefined if not.
 */
 function updateArrayPathForMove(op: JSONPatchOp, pathName: 'from' | 'path', prefix: string, from: number, to: number, original: JSONPatchOp): JSONPatchOp {
  const path = op[pathName];
  if (!path || !path.startsWith(prefix)) return op;

  const min = Math.min(from, to);
  const max = Math.max(from, to);
  const prop = getPropAfter(path, prefix.length);
  const end = prefix.length + prop.length;
  const isFinalProp = end === path.length;
  const oldIndex = parseInt(prop);

  // If this index is not within the movement boundary, don't touch it
  if (oldIndex < min || oldIndex > max) {
    return op;
  }

  // If the index touches the boundary on an unaffected side, don't touch it
  if (pathName === 'path' && isFinalProp && isAdd(op, pathName) && (oldIndex === from || oldIndex === to)) {
    return op;
  }

  const modifier = from === min ? -1 : 1;

  let newPath = prefix + (oldIndex + modifier) + path.slice(end);
  if (op === original) op = { ...op };
  op[pathName] = newPath;
  return op;
}


/**
 * Remove any move markers placed during updateMovePath. This occurs in-place since these objects have already been
 * cloned.
 */
function removeMoveMarkers(op: JSONPatchOp) {
  if (op.path[0] === '$') {
    op.path = op.path.slice(1);
  }
  if (op.from && op.from[0] === '$') {
    op.from = op.from.slice(1);
  }
}
