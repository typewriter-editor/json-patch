import { getOpData } from '../utils/getOpData';
import { add } from './add';

export function copy(path: string, value: any, from: string) {
  // eslint-disable-next-line no-unused-vars
  const [ keys, lastKey, target ] = getOpData(from);

  if (target === null) {
    return `[op:copy] path not found: ${from}`;
  }

  return add(path, target[lastKey]);
}
