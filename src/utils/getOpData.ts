import { State } from '../types';
import { EMPTY, pluck } from './pluck';
import { toKeys } from './toKeys';

export function getOpData(state: State, path: string, createMissingObjects?: boolean) {
  const keys = toKeys(path);
  const lastKey = keys[keys.length - 1];
  let target = pluck(state, keys);
  if (createMissingObjects) target = target || EMPTY;
  return [ keys, lastKey, target ];
}
