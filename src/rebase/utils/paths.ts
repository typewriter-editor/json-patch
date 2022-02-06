
export function getPrefix(path: string): string {
  const lastSlash = path.lastIndexOf('/');
  return path.slice(0, lastSlash + 1);
}

export function getProp(path: string): string {
  const lastSlash = path.lastIndexOf('/');
  return path.slice(lastSlash + 1);
}

export function getPrefixAndProp(path: string): [string, string] {
  const prefix = getPrefix(path);
  return [ prefix, path.slice(prefix.length) ];
}

export function getPropAfter(path: string, index: number): string {
  const lastSlash = path.indexOf('/', index);
  return path.slice(index, lastSlash === -1 ? undefined : lastSlash);
}
