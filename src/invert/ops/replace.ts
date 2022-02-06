import type { JSONPatchOp } from '../../types';

export function replace({ path }: JSONPatchOp, value: any, changedObj: any): JSONPatchOp {
  if (path.endsWith('/-')) path = path.replace('-', changedObj.length);
  return value === undefined ? { op: 'remove', path } : { op: 'replace', path, value };
}
