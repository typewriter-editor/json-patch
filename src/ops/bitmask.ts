import type { JSONPatchOpHandler } from '../types';
import { get, updateRemovedOps } from '../utils';
import { replace } from './replace';

/**
 * Create and maintain up to 15 boolean values in a single positive number (a bitmask). This can reduce the size of your
 * JSON document. Limiting the bits to 15 allows us to keep the number smaller (max of 9 characters), positive, and
 * allows us to combine multiple operations into a single number.
 *
 * ```js
 * import { bitmask } from '@json-patch/custom-types/bitmask';
 *
 * const patch = new JSONPatch([], { '@bit': bitmask });
 * ```
 *
 * Or you can subclass JSONPatch:
 * ```js
 * import { bitmask, mask } from '@json-patch/custom-types/bitmask';
 *
 * class MyJSONPatch extends JSONPatch {
 *   constructor(ops: JSONPatchOp[]) {
 *     super(ops, { '@bit': bitmask });
 *   }
 *
 *   bitOn(path: string, index: number) {
 *     return this.op('@bit', path, mask(index, true));
 *   }
 *
 *   bitOff(path: string, index: number) {
 *     return this.op('@bit', path, mask(index, false));
 *   }
 * }
 */
export const bit: JSONPatchOpHandler = {
  like: 'replace',

  apply(state, path, value, _, createMissingObjects) {
    return replace.apply(state, path, applyBitmask(get(state, path) || 0, value || 0), '', createMissingObjects);
  },
  transform(state, thisOp, otherOps) {
    return updateRemovedOps(state, thisOp.path, otherOps, false, true);
  },
  invert(state, op, value, changedObj, isIndex) {
    return replace.invert(state, op, value, changedObj, isIndex);
  },
  compose(state, value1, value2) {
    return combineBitmasks(value1, value2);
  },
};

/**
 * A helper function to create a mask number for bitmask operations. The bottom 15 bits are used to turn bits on, and
 * the top 15 bits are used to turn bits off.
 */
export function bitmask(index: number, value: boolean): number {
  if (index < 0 || index > 14) throw new Error('Index must be between 0 and 14');
  return value ? 1 << index : 1 << (index + 15);
}

function applyBitmask(num: number, mask: number): number {
  const offMask = (mask >> 15) & 0x7fff;
  const onMask = mask & 0x7fff;

  num &= ~offMask;
  num |= onMask;

  return num;
}

export function combineBitmasks(a: number, b: number): number {
  const aOff = (a >> 15) & 0x7fff;
  const aOn = a & 0x7fff;

  const bOff = (b >> 15) & 0x7fff;
  const bOn = b & 0x7fff;

  const combinedOn = (aOn & ~bOff) | bOn;
  const combinedOff = (aOff & ~bOn) | bOff;

  return (combinedOff << 15) | combinedOn;
}
