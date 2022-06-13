import type { JSONPatchOp } from '../../types';
import { log } from '../utils/log';
import { updateRemovedOps } from '../utils/ops';

export function replace(other: JSONPatchOp, ops: JSONPatchOp[], priority: boolean) {
  log('Transforming ', ops,' against "replace"', other);
  return updateRemovedOps(other.path, ops, priority);
}
