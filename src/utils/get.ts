import { State } from '../types';
import { getOpData } from './getOpData';

export function get(state: State, path: string) {
  // eslint-disable-next-line no-unused-vars
  const [ keys, lastKey, target ] = getOpData(state, path);
  return target ? target[lastKey] : undefined;
}
