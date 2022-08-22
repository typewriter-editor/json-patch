const chars = ('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz').split('');
const charsNext = chars.reduce((obj, char, i) => (obj[char] = chars[i + 1] || '0') && obj, {} as any);
charsNext['undefined'] = '0';

// 14,776,336 numbers can be represented in only 4 characters, 916 million in 5, 56.8 billion in 6, and 3.5 trillion
// with 7 characters (62^n). Padding to 4 or 5 characters should be sufficient for operational transformation revs.
export function revInc(rev?: string, stringLength?: number) {
  if (!rev) return '0'.repeat(stringLength || 1);
  let str = [], i = rev.length - 1;
  for (; i >= -1; i--) {
    const next = charsNext[rev[i]];
    str.push(next);
    if (next !== '0') break;
  }
  rev = rev.slice(0, Math.max(i, 0)) + str.reverse().join('');
  if (stringLength && rev.length !== stringLength) {
    rev = rev.length < stringLength ? '0'.repeat(stringLength - rev.length) + rev : rev.slice(rev.length - stringLength);
  }
  return rev;
}

export function revLessThan(a: string, b: string) {
  if (a.length !== b.length) return a.length < b.length;
  return a < b;
}
