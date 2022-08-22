const chars = ('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz').split('');
const charsNext = chars.reduce((obj, char, i) => (obj[char] = chars[i + 1] || '0') && obj, {} as any);
charsNext['undefined'] = '0';

export function revInc(rev: string) {
  if (!rev) return '0';
  let str = [], i = rev.length - 1;
  for (; i >= -1; i--) {
    const next = charsNext[rev[i]];
    str.push(next);
    if (next !== '0') break;
  }
  return rev.slice(0, Math.max(i, 0)) + str.reverse().join('');
}

export function revLessThan(a: string, b: string) {
  if (a.length !== b.length) return a.length < b.length;
  return a < b;
}
