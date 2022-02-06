import type { JSONPatchOp, InvertHandler, JSONPatchCustomTypes } from './types';
import * as inversions from './invert/ops';

export function invertPatch(object: any, ops: JSONPatchOp[], types: JSONPatchCustomTypes = {}): JSONPatchOp[] {
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

    const handler = types[op.op]?.invert || (inversions as {[name: string]: InvertHandler})[op.op];
    if (!handler) throw new Error('Unknown patch operation, cannot invert');

    return handler(op, value, changedObj, isIndex);
  }).filter(op => !!op).reverse();
}
