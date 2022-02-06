import type { JSONPatchOp } from '../../types';
import { filterNoops, mapOps } from './ops';
import { log } from './log';
import { getPrefixAndProp } from './paths';
import { updateArrayPath } from './updateArrayPath';

/**
 * Update array indexes to account for values being added or removed from an array. If the path is not an array index
 * or if nothing is changed then the original array is returned.
 */
 export function updateArrayIndexes(overPath: string, ops: JSONPatchOp[], modifier: 1 | -1) {
  // Check if over path is to an array index
  const [ arrayPrefix, indexStr ] = getPrefixAndProp(overPath);
  const index = parseInt(indexStr);

  log('Shifting array indexes', overPath, modifier);

  // Check ops for any that need to be replaced
  return filterNoops(mapOps(ops, op => {
    const original = op;
    // check for items from the same array that will be affected
    op = updateArrayPath(op, 'from', arrayPrefix, index, original, modifier) as JSONPatchOp;
    return op && updateArrayPath(op, 'path', arrayPrefix, index, original, modifier) as JSONPatchOp;
  }));
}
