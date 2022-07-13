import type { JSONPatchOp } from '../../types';
import { log } from '../utils/log';
import { updateReplacedOps } from '../utils/ops';

export function replace(other: JSONPatchOp, ops: JSONPatchOp[], priority: boolean) {
  log('Transforming ', ops,' against "replace"', other);
  // This isn't the same as a remove. Replaced items can be moved. Needs fixing.
  return updateReplacedOps(other.path, ops, priority);
}
