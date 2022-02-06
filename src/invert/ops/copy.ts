import type { JSONPatchOp } from '../../types';
import { add } from './add';

export function copy(op: JSONPatchOp, value: any, changedObj: any, isIndex: boolean): JSONPatchOp {
  return add(op, isIndex, value, changedObj);
}
