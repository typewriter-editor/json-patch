import { getOpData } from '../utils/getOpData';
import { pluckWithShallowCopy } from '../utils/pluck';
import { toArrayIndex } from '../utils/toArrayIndex';

export function remove(path: string) {
  const [ keys, lastKey, target ] = getOpData(path);

  if (target === null) {
    return `[op:remove] path not found: ${path}`;
  }

  if (Array.isArray(target)) {
    const index = toArrayIndex(target, lastKey);
    if (target.length <= index) {
      return "[op:remove] invalid array index: " + path;
    }
    pluckWithShallowCopy(keys).splice(index, 1);
  } else {
    delete pluckWithShallowCopy(keys)[lastKey];
  }
}
