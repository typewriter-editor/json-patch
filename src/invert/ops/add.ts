import type { JSONPatchOp } from '../../types';

export function add({ path }: JSONPatchOp, value: any, changedObj: any, isIndex: boolean): JSONPatchOp {
  if (path.endsWith('/-')) return { op: 'remove', path: path.replace('-', changedObj.length) };
  else if (isIndex) return { op: 'remove', path };
  return (value === undefined ? { op: 'remove', path } : { op: 'replace', path, value });
}
