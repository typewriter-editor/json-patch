import { pluck } from './pluck';
import { toKeys } from './toKeys';
export function getOpData(path) {
    const keys = toKeys(path);
    const lastKey = keys[keys.length - 1];
    const target = pluck(keys);
    return [keys, lastKey, target];
}
