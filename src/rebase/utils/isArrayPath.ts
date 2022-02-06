const arrayPathExp = /\/(0|[1-9]\d*)$/;

/**
 * Check if the path is to an array index and return the prefix and index.
 */
export function isArrayPath(path: string) {
  return arrayPathExp.test(path);
}
