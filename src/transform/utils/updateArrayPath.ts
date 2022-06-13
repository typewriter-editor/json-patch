import type { JSONPatchOp } from '../../types';
import { isAdd, isReplace } from './ops';
import { getPropAfter } from './paths';

/**
 * Get the adjusted path if it is higher, or undefined if not.
 */
 export function updateArrayPath(op: JSONPatchOp, pathName: 'from' | 'path', prefix: string, index: number, original: JSONPatchOp, modifier: 1 | -1, priority: boolean): JSONPatchOp | [JSONPatchOp,JSONPatchOp] | null {
  const path = op[pathName];
  if (!path || !path.startsWith(prefix)) return op;

  const prop = getPropAfter(path, prefix.length);
  const end = prefix.length + prop.length;
  const oldIndex = parseInt(prop);

  if (oldIndex < index) return op;

  // When this is a removed item and the op is a subpath or a non-add, remove it.
  if (oldIndex === index && modifier === -1) {
    if (end === path.length) {
      // If we are adding to the location something got removed, continue adding it.
      if (isAdd(op, pathName)) return op;
      // If we are replacing an item which was removed, add it (don't replace something else in the array)
      if (isReplace(op)) {
        if (op.op === 'replace') return { ...op, op: 'add' };
        // For custom types, we can't just change them to an add, so we need to do an add + replace (or rather, add + @customType)
        return [ { op: 'add', path: op.path, value: null }, op ];
      }
    }
    return null;
  } else if (priority && oldIndex === index && end === path.length && isAdd(op, pathName)) {
    return op;
  }

  const newPath = prefix + (oldIndex + modifier) + path.slice(end);
  if (op === original) op = { ...op };
  op[pathName] = newPath;
  return op;
}
