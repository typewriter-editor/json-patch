import type { JSONPatchOp } from '../../types';
import { isAdd, isReplace } from './ops';
import { getPropAfter } from './paths';

/**
 * Adjust ops within an array
 */
 export function updateArrayPath(op: JSONPatchOp, pathName: 'from' | 'path', prefix: string, otherIndex: number, original: JSONPatchOp, modifier: 1 | -1, priority: boolean): JSONPatchOp | [JSONPatchOp,JSONPatchOp] | null {
  const path = op[pathName];
  if (!path || !path.startsWith(prefix)) return op;

  const prop = getPropAfter(path, prefix.length);
  const end = prefix.length + prop.length;
  const thisIndex = parseInt(prop);

  if (thisIndex < otherIndex) return op;

  // When this is a removed item and the op is a subpath or a non-add, remove it.
  if (thisIndex === otherIndex && modifier === -1) {
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
  } else if (!priority && thisIndex === otherIndex && end === path.length && isAdd(op, pathName)) {
    return op;
  }

  const newPath = prefix + (thisIndex + modifier) + path.slice(end);
  if (op === original) op = { ...op };
  op[pathName] = newPath;
  return op;
}

/*

Move operations must be treated uniquely among all other operations. They are essentially a remove + add in one.

Perhaps the easiest thing to do is to model everything without moves, then add in code specific to moves within
each set of operations. Start over from scratch and simplify things to work without move being involved.

And actually, a replace may also be considered different. It is a remove + add on the same path. It acts the same as
an add except for within Arrays.

So, first model add/copy & remove. Then model in replace. Then model move.

We also need to handle copying an object that was removed or replaced. Even if the copy lands first, the client that
removed the object won't have it in memory anymore to process the copy when applying the copy later, so the copy will
need to be removed as well. Same with a move. If an item is moved but the original is removed, the final needs to be
removed as well. This would give "remove" priority over other types, unfortunately.

We could make copy transform to an add with the value to make it more resillient, losing the optimization that a copy
provides.

The only sure-fire way to transform copy/remove is to remove the copy. :(


Add: insert an item into an array or set a property on an object



*/
