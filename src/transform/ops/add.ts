import type { JSONPatchOp } from '../../types';
import { isArrayPath } from '../utils/isArrayPath';
import { isEmptyObject, updateEmptyObjects } from '../utils/emptyObjects';
import { log } from '../utils/log';
import { updateArrayIndexes } from '../utils/updateArrayIndexes';
import { updateRemovedOps } from '../utils/ops';

export function add(other: JSONPatchOp, ops: JSONPatchOp[], priority: boolean): JSONPatchOp[] {
  log('Transforming', ops, 'against "add"', other);

  if (isArrayPath(other.path)) {
    // Adjust any operations on the same array by 1 to account for this new entry
    return updateArrayIndexes(other.path, ops, 1, priority);
  } else if (isEmptyObject(other.value)) {
    // Treat empty objects specially. If two empty objects are added to the same location, don't overwrite the existing
    // one, allowing for the merging of maps together
    return updateEmptyObjects(other.path, ops);
  } else {
    // Remove anything that was done at this path since it is being overwritten
    return updateRemovedOps(other.path, ops, priority);
  }
}
