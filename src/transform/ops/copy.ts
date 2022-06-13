import type { JSONPatchOp } from '../../types';
import { isArrayPath } from '../utils/isArrayPath';
import { log } from '../utils/log';
import { updateRemovedOps } from '../utils/ops';
import { updateArrayIndexes } from '../utils/updateArrayIndexes';

export function copy(other: JSONPatchOp, ops: JSONPatchOp[], priority: boolean) {
  log('Transforming', ops, 'against "copy"', other);
  // Copy is the same as add with paths, only the value is different
  if (isArrayPath(other.path)) {
    return updateArrayIndexes(other.path, ops, 1, priority);
  } else {
    return updateRemovedOps(other.path, ops, priority);
  }
}
