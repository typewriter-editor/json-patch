import type { JSONPatchOp } from '../types';
import { mapAndFilterOps } from './ops';
import { log } from './log';
import { getPrefixAndProp } from './paths';
import { updateArrayPath } from './updateArrayPath';

/**
 * Update array indexes to account for values being added or removed from an array.
 */
 export function updateArrayIndexes(thisPath: string, otherOps: JSONPatchOp[], modifier: 1 | -1): JSONPatchOp[] {
  const [ arrayPrefix, indexStr ] = getPrefixAndProp(thisPath);
  const index = parseInt(indexStr);

  log('Shifting array indexes', thisPath, modifier);

  // Check ops for any that need to be replaced
  return mapAndFilterOps(otherOps, op => {
    // check for items from the same array that will be affected
    op = updateArrayPath(op, 'from', arrayPrefix, index, modifier) as JSONPatchOp;
    return op && updateArrayPath(op, 'path', arrayPrefix, index, modifier) as JSONPatchOp;
  });
}
