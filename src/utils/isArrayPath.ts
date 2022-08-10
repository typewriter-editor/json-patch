import { root } from '../state';
import { getOpData, getPrefixAndProp } from '../utils';

const arrayPathExp = /\/(0|[1-9]\d*)$/;
const EMPTY: any = [];

/**
 * Check if the path is to an array index
 */
export function isArrayPath(path: string) {
  if (!arrayPathExp.test(path)) return false;
  if (!root || !root['']) return true;
  const [ _, __, target ] = getOpData(path);
  return Array.isArray(target);
}


/**
 * Check if the path is to an array index and return the prefix and index.
 */
export function getArrayPath(path: string): [string, number] {
  if (!arrayPathExp.test(path)) return EMPTY;
  const [ _, __, target ] = getOpData(path);
  if (!Array.isArray(target)) return EMPTY;
  const [ prefix, indexStr ] = getPrefixAndProp(path);
  const index = parseInt(indexStr);
  return [ prefix, index ];
}
