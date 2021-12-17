export function throwException(message) {
    if (typeof message === 'string') {
        throw new TypeError(message);
    }
    return false;
}
