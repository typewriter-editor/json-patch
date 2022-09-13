import { runWithObject } from './state';
import type { JSONPatchOp, JSONPatchOpHandlerMap } from './types';
import { getType, getValue, mapAndFilterOps } from './utils';
import { getTypes } from './ops';

export function composePatch(patches: JSONPatchOp[], custom: JSONPatchOpHandlerMap = {}): JSONPatchOp[] {
  const types = getTypes(custom);
  let lastHandlable: JSONPatchOp | null;

  // Only composing ops next to each other on the same path. It becomes too complex to do more because of moves and arrays
  return runWithObject(null, types, patches.length > 1, () => {
    return mapAndFilterOps(patches, (op, i) => {
      const type = getType(op);
      const handler = type?.compose;
      if (handler) {
        if (lastHandlable && match(op, lastHandlable)) {
          lastHandlable.value = handler(lastHandlable.value, op.value);
          return null;
        } else if (match(op, patches[i + 1])) {
          lastHandlable = op = getValue(op);
        }
      } else {
        lastHandlable = null;
      }
      return op;
    });
  });
}

function match(op1: JSONPatchOp, op2?: JSONPatchOp) {
  return op1 && op2 && op1.op === op2.op && op1.path === op2.path;
}
