export let root;
export let cache;
export function patchWith(object, shouldCache, callback) {
    root = { '': object };
    cache = shouldCache ? new Set() : null;
    const result = callback() || root[''];
    root = null;
    cache = null;
    return result;
}
