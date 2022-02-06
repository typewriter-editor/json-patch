import type { JSONPatchOp } from '../../types';
import { isAdd } from './ops';
import { getPropAfter } from './paths';

/**
 * Get the adjusted path if it is higher, or undefined if not.
 */
 export function updateArrayPath(op: JSONPatchOp, pathName: 'from' | 'path', prefix: string, index: number, original: JSONPatchOp, modifier: 1 | -1): JSONPatchOp | null {
  const path = op[pathName];
  if (!path || !path.startsWith(prefix)) return op;

  const prop = getPropAfter(path, prefix.length);
  const end = prefix.length + prop.length;
  const oldIndex = parseInt(prop);

  if (oldIndex < index) return op;

  // When this is a removed item and the op is a subpath or a non-add, remove it.
  if (oldIndex === index && modifier === -1) {
    if (isAdd(op, pathName) && end === path.length) {
      return op;
    }
    return null;
  }

  const newPath = prefix + (oldIndex + modifier) + path.slice(end);
  if (op === original) op = { ...op };
  op[pathName] = newPath;
  return op;
}
