import type { JSONPatchOp } from '../../types';
import { isArrayPath } from '../utils/isArrayPath';
import { isEmptyObject, updateEmptyObjects } from '../utils/emptyObjects';
import { log } from '../utils/log';
import { updateArrayIndexes } from '../utils/updateArrayIndexes';
import { updateRemovedOps } from '../utils/ops';

export function add(other: JSONPatchOp, ops: JSONPatchOp[], priority: boolean): JSONPatchOp[] {
  log('Transforming', ops, 'against "add"', other);
  if (isArrayPath(other.path)) {
    return updateArrayIndexes(other.path, ops, 1, priority);
  } else if (isEmptyObject(other.value)) {
    return updateEmptyObjects(other.path, ops);
  } else {
    return updateRemovedOps(other.path, ops, priority);
  }
}
