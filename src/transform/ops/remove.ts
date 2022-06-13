import type { JSONPatchOp } from '../../types';
import { isArrayPath } from '../utils/isArrayPath';
import { log } from '../utils/log';
import { updateRemovedOps } from '../utils/ops';
import { updateArrayIndexes } from '../utils/updateArrayIndexes';

export function remove(other: JSONPatchOp, ops: JSONPatchOp[], priority: boolean) {
  log('Transforming', ops, 'against "remove"', other);
  if (isArrayPath(other.path)) {
    return updateArrayIndexes(other.path, ops, -1, priority);
  } else {
    return updateRemovedOps(other.path, ops, priority);
  }
}
