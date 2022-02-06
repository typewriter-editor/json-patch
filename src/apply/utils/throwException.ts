
export function throwException(message: string | void) {
  if (typeof message === 'string') {
    throw new TypeError(message);
  }
  return false;
}
