import { deepEqual } from '../utils/deepEqual';
import { getOpData } from '../utils/getOpData';
import { pluckWithShallowCopy } from '../utils/pluck';
import { toArrayIndex } from '../utils/toArrayIndex';

export function add(path: string, value: any) {
  if (typeof value === 'undefined') {
    return '[op:add] require value, but got undefined';
  }
  const [ keys, lastKey, target ] = getOpData(path);

  if (target === null) {
    return `[op:add] path not found: ${path}`;
  }

  if (Array.isArray(target)) {
    const index = toArrayIndex(target, lastKey);
    if (target.length < index) {
      return `[op:add] invalid array index: ${path}`;
    }
    pluckWithShallowCopy(keys).splice(index, 0, value);
  } else {
    if (!deepEqual(target[lastKey], value)) {
      pluckWithShallowCopy(keys)[lastKey] = value;
    }
  }
}
