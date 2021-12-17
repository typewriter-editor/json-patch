import { Root } from './types';

export let root: Root | null;
export let cache: Set<any> | null;


export function patchWith(object: any, shouldCache: boolean, callback: Function) {
  root = { '': object };
  cache = shouldCache ? new Set() : null;
  const result = callback() || root[''];
  root = null;
  cache = null;
  return result;
}
