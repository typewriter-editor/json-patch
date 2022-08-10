import { runWithObject } from './state';
import type { JSONPatchOp, JSONPatchOpHandlerMap } from './types';
import { getType, mapAndFilterOps } from './utils';
import * as defaultTypes from './ops';

export function composePatch(patches: JSONPatchOp[], custom: JSONPatchOpHandlerMap = {}): JSONPatchOp[] {
  const types = custom ? { ...defaultTypes, ...custom } : defaultTypes;
  const opsByPath = new Map<string, JSONPatchOp>();

  return runWithObject({}, types, false, () => {
    return mapAndFilterOps(patches, op => {
      const handler = getType(op)?.compose;
      if (!handler) return op;
      const lastOp = opsByPath.get(op.path);
      if (lastOp) op = { ...op, value: handler(lastOp.value, op.value) };
      opsByPath.set(op.path, op);
      return op;
    });
  });
}
