import type { State } from '../types.js';
import { getOpData } from './getOpData.js';

const arrayPathExp = /\/(0|[1-9]\d*)$/;
const EMPTY: any = [];

export function getPrefix(path: string): string {
  const lastSlash = path.lastIndexOf('/');
  return path.slice(0, lastSlash + 1);
}

export function getProp(path: string): string {
  const lastSlash = path.lastIndexOf('/');
  return path.slice(lastSlash + 1);
}

export function getPrefixAndProp(path: string): [string, string] {
  const prefix = getPrefix(path);
  return [prefix, path.slice(prefix.length)];
}

export function getPropAfter(path: string, index: number): string {
  const lastSlash = path.indexOf('/', index);
  return path.slice(index, lastSlash === -1 ? undefined : lastSlash);
}

export function isArrayPath(path: string, state?: State) {
  if (!arrayPathExp.test(path)) return false;
  if (!state || !state.root || !state.root['']) return true;
  // Double-check if this is an array or not
  const [_, __, target] = getOpData(state, path);
  return Array.isArray(target) || target == null;
}

export function getArrayPrefixAndIndex(state: State, path: string, pathLength?: number): [string, number] {
  if (pathLength) path = path.slice(0, path.indexOf('/', pathLength));
  if (!arrayPathExp.test(path)) return EMPTY;
  const [_, __, target] = getOpData(state, path);
  if (!Array.isArray(target)) return EMPTY;
  const [prefix, indexStr] = getPrefixAndProp(path);
  const index = parseInt(indexStr);
  return [prefix, index];
}

export function getArrayIndex(state: State, path: string, pathLength?: number): number {
  return getArrayPrefixAndIndex(state, path, pathLength)[1];
}

export function getIndexAndEnd(state: State, path: string | undefined, maxLength: number) {
  if (!path) return [];
  const prop = getPropAfter(path, maxLength);
  const end = maxLength + prop.length;
  if (!isArrayPath(path.slice(0, end), state)) return [];
  const index = parseInt(prop);
  return [index, end];
}
