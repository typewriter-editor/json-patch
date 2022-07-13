import { root } from '../state';
import { getOpData } from '../utils';

const arrayPathExp = /\/(0|[1-9]\d*)$/;

/**
 * Check if the path is to an array index and return the prefix and index.
 */
export function isArrayPath(path: string) {
  if (!arrayPathExp.test(path)) return false;
  if (!root || !root['']) return true;
  const [ _, __, target ] = getOpData(path);
  return Array.isArray(target);
}
