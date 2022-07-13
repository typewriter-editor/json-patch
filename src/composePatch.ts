import type { JSONPatchOp, JSONPatchOpHandlerMap } from './types';
import { getType, mapAndFilterOps } from './utils';

export function composePatch(patches: JSONPatchOp[], custom: JSONPatchOpHandlerMap = {}): JSONPatchOp[] {
  const opsByPath = new Map<string, JSONPatchOp>();

  return mapAndFilterOps(patches, op => {
    const handler = getType(op, custom)?.compose;
    if (!handler) return op;
    const lastOp = opsByPath.get(op.path);
    if (lastOp) op = handler(lastOp, op);
    opsByPath.set(op.path, op);
    return op;
  });
}
