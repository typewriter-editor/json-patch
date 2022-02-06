import type { JSONPatchOp } from '../../types';

export function move({ path, from }: JSONPatchOp): JSONPatchOp {
  return { op: 'move', from: path, path: '' + from };
}
