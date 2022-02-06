import type { JSONPatchOp } from '../../types';
import { isArrayPath } from '../utils/isArrayPath';
import { log } from '../utils/log';
import { updateRemovedOps } from '../utils/ops';
import { updateArrayIndexes } from '../utils/updateArrayIndexes';

export function remove(over: JSONPatchOp, ops: JSONPatchOp[]) {
  log('Rebasing', ops, 'over "remove"', over);
  if (isArrayPath(over.path)) {
    return updateArrayIndexes(over.path, ops, -1);
  } else {
    return updateRemovedOps(over.path, ops);
  }
}
