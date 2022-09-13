import { runWithObject } from './state';
import type { JSONPatchOp, JSONPatchOpHandlerMap } from './types';
import { getType, isAdd, isArrayPath, mapAndFilterOps } from './utils';
import { getTypes } from './ops';

export function composePatch(obj: any, patches: JSONPatchOp[], custom: JSONPatchOpHandlerMap = {}): JSONPatchOp[] {
  const types = getTypes(custom);
  const opsByPath = new Map<string, JSONPatchOp>();

  return runWithObject(obj, types, false, () => {
    return mapAndFilterOps(patches, op => {
      const type = getType(op);
      const handler = type?.compose;
      if (!handler) {
        const like = type?.like;
        // If the data has been overwritten, don't compose future ops with it
        if (like === 'replace' || like === 'remove' || (isAdd(op, 'path') && !isArrayPath(op.path))) {
          opsByPath.delete(op.path);
        }
        if (like === 'move' && opsByPath.has(op.from as string)) {
          opsByPath.delete(op.from as string);
        }
        return op;
      }
      const lastOp = opsByPath.get(op.path);
      if (lastOp) lastOp.value = handler(lastOp.value, op.value);
      else op = { ...op };
      opsByPath.set(op.path, op);
      return lastOp ? null : op;
    });
  });
}
