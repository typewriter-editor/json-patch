import type { JSONPatchOp, JSONPatchOpHandler } from '../types';
import { add } from './add';
import { pluckWithShallowCopy } from '../utils/pluck';
import { toArrayIndex } from '../utils/toArrayIndex';
import { getOpData } from '../utils/getOpData';
import { getPrefix, getProp, getPropAfter, isAdd, isArrayPath, log, mapAndFilterOps, updateArrayIndexes, updateRemovedOps } from '../utils';

export const move: JSONPatchOpHandler = {
  like: 'move',

  apply(path, value, from: string) {
    if (path === from) return;
    const [ keys, lastKey, target ] = getOpData(from);

    if (target === null) {
      return `[op:move] path not found: ${from}`;
    }

    if (Array.isArray(target)) {
      const index = toArrayIndex(target, lastKey);
      if (target.length <= index) {
        return `[op:move] invalid array index: ${path}`;
      }
      value = target[index];
      pluckWithShallowCopy(keys).splice(index, 1);
    } else {
      value = target[lastKey];
      delete pluckWithShallowCopy(keys)[lastKey];
    }

    return add.apply(path, value);
  },

  invert({ path, from }) {
    return { op: 'move', from: path, path: '' + from };
  },

  transform(thisOp, otherOps, thisFirst) {
    log('Transforming', otherOps, 'against "move"', thisOp);
    let removed = false;
    const { from, path } = thisOp as { from: string, path: string };

    /*
    A move needs to do a "remove" and an "add" at once with `from` and `path`. If it is being moved from one location in
    an array to another in the same array, this needs to be handled special.

    1. Ops that were added to where the move lands when not an array should be removed just like with an add/copy
    2. Ops that were added to where the move came from should be translated to the new path
    3. Ops that are in an array with the moved item before or after need to be adjusted up or down
      3a. But, ops that were translated to the new path shouldn't get adjusted up or down by these adjustments
    */

    // A move removes the value from one place then adds it to another, update the paths and add a marker to them so
    // they won't be altered by `updateArrayIndexes`, then remove the markers afterwards
    otherOps = mapAndFilterOps(otherOps, op => {
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
      otherOps = updateArrayIndexesForMove(from, path, otherOps, thisFirst);
    } else {
      // if a move is not within one array, treat it as a remove then add
      if (isArrayPath(from)) {
        otherOps = updateArrayIndexes(from, otherOps, -1, thisFirst);
      } else {
        otherOps = updateRemovedOps(from, otherOps, thisFirst);
      }

      if (isArrayPath(path)) {
        otherOps = updateArrayIndexes(path, otherOps, 1, thisFirst);
      } else {
        otherOps = updateRemovedOps(path, otherOps, thisFirst);
      }
    }

    // Remove the move markers added with `updateMovePath`
    otherOps.forEach(removeMoveMarkers);
    return otherOps;
  }

};


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
function updateArrayIndexesForMove(thisFrom: string, thisPath: string, otherOps: JSONPatchOp[], thisFirst: boolean) {
  const fromIndex = parseInt(getProp(thisFrom));
  const pathIndex = parseInt(getProp(thisPath));
  const prefix = getPrefix(thisFrom);

  // Check ops for any that need to be replaced
  log('Shifting array indexes for a move between', thisFrom, 'and', thisPath);

  return mapAndFilterOps(otherOps, op => {
    const original = op;
    // check for items from the same array that will be affected
    op = updateArrayPathForMove(op, 'from', prefix, fromIndex, pathIndex, original, thisFirst);
    return op && updateArrayPathForMove(op, 'path', prefix, fromIndex, pathIndex, original, thisFirst);
  });
}


/**
 * Get the adjusted path if it is higher, or undefined if not.
 */
 function updateArrayPathForMove(otherOp: JSONPatchOp, pathName: 'from' | 'path', prefix: string, from: number, to: number, original: JSONPatchOp, thisFirst: boolean): JSONPatchOp {
  const path = otherOp[pathName];
  if (!path || !path.startsWith(prefix)) return otherOp;

  const min = Math.min(from, to);
  const max = Math.max(from, to);
  const prop = getPropAfter(path, prefix.length);
  const end = prefix.length + prop.length;
  const isFinalProp = end === path.length;
  const oldIndex = parseInt(prop);

  // If this index is not within the movement boundary, don't touch it
  if (oldIndex < min || oldIndex > max) {
    return otherOp;
  }

  // TODO take into account thisFirst here too?
  // If the index touches the boundary on an unaffected side, don't touch it
  if (pathName === 'path' && isFinalProp && isAdd(otherOp, pathName) && (oldIndex === min || (oldIndex === max && to < from))) {
    return otherOp;
  }

  const modifier = from === min ? -1 : 1;

  let newPath = prefix + (oldIndex + modifier) + path.slice(end);
  if (otherOp === original) otherOp = { ...otherOp };
  otherOp[pathName] = newPath;
  return otherOp;
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
