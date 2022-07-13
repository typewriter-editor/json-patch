import type { JSONPatchOp } from '../types';
import { mapAndFilterOps } from './ops';
import { log } from './log';
import { getPrefixAndProp } from './paths';
import { updateArrayPath } from './updateArrayPath';

/**
 * Update array indexes to account for values being added or removed from an array.
 */
 export function updateArrayIndexes(otherPath: string, ops: JSONPatchOp[], modifier: 1 | -1, priority: boolean): JSONPatchOp[] {
  const [ arrayPrefix, indexStr ] = getPrefixAndProp(otherPath);
  const index = parseInt(indexStr);

  log('Shifting array indexes', otherPath, modifier);

  // Check ops for any that need to be replaced
  return mapAndFilterOps(ops, op => {
    const original = op;
    // check for items from the same array that will be affected
    op = updateArrayPath(op, 'from', arrayPrefix, index, original, modifier, priority) as JSONPatchOp;
    return op && updateArrayPath(op, 'path', arrayPrefix, index, original, modifier, priority) as JSONPatchOp;
  });
}
