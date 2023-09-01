import { types } from '../state';
import type { JSONPatchOp } from '../types';

export function getType(patch: JSONPatchOp) {
  return types?.[patch.op];
}

export function getTypeLike(patch: JSONPatchOp) {
  return types?.[patch.op]?.like;
}

