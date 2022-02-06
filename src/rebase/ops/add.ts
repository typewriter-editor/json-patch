import type { JSONPatchOp } from '../../types';
import { isArrayPath } from '../utils/isArrayPath';
import { isEmptyObject, updateEmptyObjects } from '../utils/emptyObjects';
import { log } from '../utils/log';
import { updateArrayIndexes } from '../utils/updateArrayIndexes';
import { updateRemovedOps } from '../utils/ops';

export function add(over: JSONPatchOp, ops: JSONPatchOp[]) {
  log('Rebasing', ops, 'over "add"', over);
  if (isArrayPath(over.path)) {
    return updateArrayIndexes(over.path, ops, 1);
  } else if (isEmptyObject(over.value)) {
    return updateEmptyObjects(over.path, ops);
  } else {
    return updateRemovedOps(over.path, ops);
  }
}
