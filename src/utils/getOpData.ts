import type { State } from '../types.js';
import { EMPTY, pluck } from './pluck.js';
import { toKeys } from './toKeys.js';

export function getOpData(state: State, path: string, createMissingObjects?: boolean) {
  const keys = toKeys(path);
  const lastKey = keys[keys.length - 1];
  let target = pluck(state, keys);
  if (createMissingObjects) target = target || EMPTY;
  return [keys, lastKey, target];
}
