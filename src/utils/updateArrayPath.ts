import type { JSONPatchOp } from '../types';
import { isAdd, isReplace } from './ops';
import { getPropAfter } from './paths';

/**
 * Adjust ops within an array
 */
 export function updateArrayPath(otherOp: JSONPatchOp, pathName: 'from' | 'path', thisPrefix: string, thisIndex: number, original: JSONPatchOp, modifier: 1 | -1, thisFirst: boolean): JSONPatchOp | [JSONPatchOp,JSONPatchOp] | null {
  const path = otherOp[pathName];
  if (!path || !path.startsWith(thisPrefix)) return otherOp;

  const prop = getPropAfter(path, thisPrefix.length);
  const end = thisPrefix.length + prop.length;
  const otherIndex = parseInt(prop);

  if (otherIndex < thisIndex) return otherOp;

  // When this is a removed item and the op is a subpath or a non-add, remove it.
  if (otherIndex === thisIndex && modifier === -1) {
    if (end === path.length) {
      // If we are adding to the location something got removed, continue adding it.
      if (isAdd(otherOp, pathName)) return otherOp;
      // If we are replacing an item which was removed, add it (don't replace something else in the array)
      if (isReplace(otherOp)) {
        if (otherOp.op === 'replace') return { ...otherOp, op: 'add' };
        // For custom types, we can't just change them to an add, so we need to do an add + replace (or rather, add + @customType)
        return [ { op: 'add', path: otherOp.path, value: null }, otherOp ];
      }
    }
    return null;
  } else if (!thisFirst && otherIndex === thisIndex && end === path.length && isAdd(otherOp, pathName)) {
    return otherOp;
  }

  const newPath = thisPrefix + (otherIndex + modifier) + path.slice(end);
  if (otherOp === original) otherOp = { ...otherOp };
  otherOp[pathName] = newPath;
  return otherOp;
}
