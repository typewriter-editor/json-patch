import type { JSONPatchOp, State } from '../types.js';

export function getType(state: State, patch: JSONPatchOp) {
  return state.types?.[patch.op];
}

export function getTypeLike(state: State, patch: JSONPatchOp) {
  return state.types?.[patch.op]?.like;
}
