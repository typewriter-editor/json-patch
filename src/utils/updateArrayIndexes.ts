import type { JSONPatchOp, State } from '../types';
import { getTypeLike } from './getType';
import { log } from './log';
import { isAdd, mapAndFilterOps, transformRemove } from './ops';
import { getPrefixAndProp } from './paths';
import { updateArrayPath } from './updateArrayPath';

/**
 * Update array indexes to account for values being added or removed from an array.
 */
 export function updateArrayIndexes(state: State, thisPath: string, otherOps: JSONPatchOp[], modifier: 1 | -1, isRemove?: boolean): JSONPatchOp[] {
  const [ arrayPrefix, indexStr ] = getPrefixAndProp(thisPath);
  const index = parseInt(indexStr);

  log('Shifting array indexes', thisPath, modifier);

  // Check ops for any that need to be replaced
  return mapAndFilterOps(otherOps, (op, i, breakAfter) => {
    if (isRemove && thisPath === op.from) {
      const opLike = getTypeLike(state, op);
      if (opLike === 'move') {
        // We need the rest of the otherOps to be adjusted against this "move"
        breakAfter();
        return transformRemove(state, op.path, otherOps.slice(i + 1));
      } else if (opLike === 'copy') {
        // We need future ops on the copied object to be removed
        breakAfter();
        let rest = transformRemove(state, thisPath, otherOps.slice(i + 1));
        rest = transformRemove(state, op.path, rest);
        return rest;
      }
    }
    if (op.soft && isAdd(state, op, 'path') && op.path === thisPath) {
      breakAfter(true);
      return null;
    }
    // check for items from the same array that will be affected
    op = updateArrayPath(state, op, 'from', arrayPrefix, index, modifier) as JSONPatchOp;
    return op && updateArrayPath(state, op, 'path', arrayPrefix, index, modifier) as JSONPatchOp;
  });
}
