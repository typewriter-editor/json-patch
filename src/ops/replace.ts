import { deepEqual } from '../utils/deepEqual';
import { getOpData } from '../utils/getOpData';
import { pluckWithShallowCopy } from '../utils/pluck';
import { toArrayIndex } from '../utils/toArrayIndex';

export function replace(path: string, value: any) {
  if (typeof value === 'undefined') {
    return '[op:replace] require value, but got undefined';
  }
  const [ keys, lastKey, target ] = getOpData(path);

  if (target === null) {
    return `[op:replace] path not found: ${path}`;
  }

  if (Array.isArray(target)) {
    const index = toArrayIndex(target, lastKey);
    if (target.length <= index) {
      return `[op:replace] invalid array index: ${path}`;
    }
    if (!deepEqual(target[index], value)) {
      pluckWithShallowCopy(keys).splice(index, 1, value);
    }
  } else {
    if (!deepEqual(target[lastKey], value)) {
      pluckWithShallowCopy(keys)[lastKey] = value;
    }
  }
}
