import { root, cache } from '../state';
import { shallowCopy } from './shallowCopy';
export function pluck(keys) {
    let object = root;
    for (let i = 0, imax = keys.length - 1; i < imax; i++) {
        const key = keys[i];
        if (!object[key]) {
            return null;
        }
        object = object[key];
    }
    return object;
}
export function pluckWithShallowCopy(keys) {
    let object = root;
    for (let i = 0, imax = keys.length - 1; i < imax; i++) {
        const key = keys[i];
        object = object[key] = cache ? fetch(object, key) : shallowCopy(object[key]);
    }
    return object;
}
function fetch(object, key) {
    let value = object[key];
    if (!cache.has(value)) {
        value = shallowCopy(value);
        cache.add(value);
    }
    return value;
}
