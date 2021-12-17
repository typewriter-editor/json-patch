import { add } from './add';
import { pluckWithShallowCopy } from '../utils/pluck';
import { toArrayIndex } from '../utils/toArrayIndex';
import { getOpData } from '../utils/getOpData';

export function move(path: string, value: any, from: string) {
  if (path !== from) {
    const [ keys, lastKey, target ] = getOpData(from);

    if (target === null) {
      return `[op:move] path not found: ${from}`;
    }

    let value = void 0;

    if (Array.isArray(target)) {
      const index = toArrayIndex(target, lastKey);
      if (target.length <= index) {
        return `[op:move] invalid array index: ${path}`;
      }
      value = target[index];
      pluckWithShallowCopy(keys).splice(index, 1);
    } else {
      value = target[lastKey];
      delete pluckWithShallowCopy(keys)[lastKey];
    }

    return add(path, value);
  }
}
