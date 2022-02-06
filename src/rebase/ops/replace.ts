import type { JSONPatchOp } from '../../types';
import { log } from '../utils/log';
import { updateRemovedOps } from '../utils/ops';

export function replace(over: JSONPatchOp, ops: JSONPatchOp[]) {
  log('Transforming ', ops,' against "replace"', over);
  return updateRemovedOps(over.path, ops);
}
