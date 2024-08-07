import { getTypes } from './ops';
import { runWithObject } from './state';
import type { JSONPatchOp, JSONPatchOpHandlerMap } from './types';
import { getType } from './utils';

export function invertPatch(object: any, ops: JSONPatchOp[], custom: JSONPatchOpHandlerMap = {}): JSONPatchOp[] {
  const types = getTypes(custom);
  return runWithObject({}, types, false, state => {
    return ops.map((op): JSONPatchOp => {
      const pathParts = op.path.split('/').slice(1);
      let changedObj = object;
      const prop = pathParts.pop() as string;
      let value, isIndex;

      try {
        for (let i = 0; i < pathParts.length; i++) {
          changedObj = changedObj[pathParts[i]];
        }
        value = changedObj[prop];
        isIndex = (prop as any) >= 0;
      } catch (err: any) {
        throw new Error(`Patch mismatch. This patch was not applied to the provided object and cannot be inverted. ${err.message || err}`);
      }

      const handler = getType(state, op)?.invert;
      if (!handler) throw new Error('Unknown patch operation, cannot invert');

      return handler(state, op, value, changedObj, isIndex);
    }).filter(op => !!op).reverse();
  });
}
