import type { JSONPatchOp } from '../../types';

export function remove({ path }: JSONPatchOp, value: any): JSONPatchOp {
  return { op: 'add', path, value };
}
