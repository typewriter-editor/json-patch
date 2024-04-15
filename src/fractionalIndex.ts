/**
 * Utilities for fractional indexing to sort documents by a string field instead of putting them in an array. This is
 * for use with the LastWriteWins strategy provided by syncable.
 */
const digits = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const INTEGER_ZERO = 'a0';
const SMALLEST_INTEGER = 'A00000000000000000000000000';
const LARGEST_INTEGER = 'zzzzzzzzzzzzzzzzzzzzzzzzzzz';
const ZERO = digits[0];

function midpoint(a: string | undefined | null, b: string | undefined | null): string {
  if (a && b && a >= b) {
    [a, b] = [b, a];
  }
  if ((a && a.slice(-1) === ZERO) || (b && b.slice(-1) === ZERO)) {
    throw new Error('Trailing zero');
  }
  if (!a) a = '';
  if (b) {
    let n = 0;
    while ((a[n] || ZERO) === b[n]) {
      n++;
    }
    if (n > 0) {
      return b.slice(0, n) + midpoint(a.slice(n), b.slice(n));
    }
  }
  const digitA = a ? digits.indexOf(a[0]) : 0;
  const digitB = b ? digits.indexOf(b[0]) : digits.length;
  if (digitB - digitA > 1) {
    const midDigit = Math.round(0.5 * (digitA + digitB));
    return digits[midDigit];
  } else {
    if (b && b.length > 1) {
      return b.slice(0, 1);
    } else {
      return digits[digitA] + midpoint(a?.slice(1), null);
    }
  }
}

function getIntegerLength(head: string): number {
  if (head >= 'a' && head <= 'z') {
    return head.charCodeAt(0) - 'a'.charCodeAt(0) + 2;
  } else if (head >= 'A' && head <= 'Z') {
    return 'Z'.charCodeAt(0) - head.charCodeAt(0) + 2;
  } else {
    throw new Error('Invalid order key head: ' + head);
  }
}

function validateInteger(int: string): void {
  if (int.length !== getIntegerLength(int[0])) {
    throw new Error('Invalid integer part of order key: ' + int);
  }
}

function incrementInteger(x: string): string {
  validateInteger(x);
  const [head, ...digs] = x.split('');
  let carry = true;
  for (let i = digs.length - 1; carry && i >= 0; i--) {
    const d = digits.indexOf(digs[i]) + 1;
    if (d === digits.length) {
      digs[i] = ZERO;
    } else {
      digs[i] = digits[d];
      carry = false;
    }
  }
  if (carry) {
    if (head === 'Z') {
      return 'a0';
    }
    if (head === 'z') {
      return '';
    }
    const h = String.fromCharCode(head.charCodeAt(0) + 1);
    if (h > 'a') {
      digs.push(ZERO);
    } else {
      digs.pop();
    }
    return h + digs.join('');
  } else {
    return head + digs.join('');
  }
}

function decrementInteger(x: string): string {
  validateInteger(x);
  const [head, ...digs] = x.split('');
  let borrow = true;
  for (let i = digs.length - 1; borrow && i >= 0; i--) {
    const d = digits.indexOf(digs[i]) - 1;
    if (d === -1) {
      digs[i] = digits.slice(-1);
    } else {
      digs[i] = digits[d];
      borrow = false;
    }
  }
  if (borrow) {
    if (head === 'a') {
      return 'Z' + digits.slice(-1);
    }
    if (head === 'A') {
      return '';
    }
    const h = String.fromCharCode(head.charCodeAt(0) - 1);
    if (h < 'Z') {
      digs.push(digits.slice(-1));
    } else {
      digs.pop();
    }
    return h + digs.join('');
  } else {
    return head + digs.join('');
  }
}

function getIntegerPart(key: string): string {
  const integerPartLength = getIntegerLength(key[0]);
  if (integerPartLength > key.length) {
    throw new Error('Invalid order key: ' + key);
  }
  return key.slice(0, integerPartLength);
}

function validatestring(key: string, lowValue: boolean): void {
  if ((lowValue && key === LARGEST_INTEGER) || (!lowValue && key === SMALLEST_INTEGER)) {
    throw new Error('Invalid order key: ' + key);
  }
  const i = getIntegerPart(key);
  const f = key.slice(i.length);
  if (f.slice(-1) === ZERO) {
    throw new Error('Invalid order key: ' + key);
  }
}

/**
 * Generate a fractional index which is a sortable string(s) between a and b. Use an empty string or null/undefined to
 * represent the start and end of the range.
 *
 * Pass a count to generate N fractional indexes between a and b.
 *
 * See https://www.figma.com/blog/realtime-editing-of-ordered-sequences/#fractional-indexing and
 * https://observablehq.com/@dgreensp/implementing-fractional-indexing for more information.
 */
export function fractionalIndex(a: string | undefined | null, b: string | undefined | null): string;
export function fractionalIndex(a: string | undefined | null, b: string | undefined | null, count: number): string[];
export function fractionalIndex(
  a: string | undefined | null,
  b: string | undefined | null,
  count?: number
): string | string[] {
  // Generate N fractional indexes between a and b
  if (count !== undefined) {
    if (count === 0) {
      return [];
    }
    if (count === 1) {
      return [fractionalIndex(a, b)];
    }
    if (!b) {
      let c = fractionalIndex(a, b);
      const result = [c];
      for (let i = 0; i < count - 1; i++) {
        c = fractionalIndex(c, b);
        result.push(c);
      }
      return result;
    }
    if (!a) {
      let c = fractionalIndex(a, b);
      const result = [c];
      for (let i = 0; i < count - 1; i++) {
        c = fractionalIndex(a, c);
        result.push(c);
      }
      result.reverse();
      return result;
    }
    const mid = Math.floor(count / 2);
    const c = fractionalIndex(a, b);
    return [...fractionalIndex(a, c, mid), c, ...fractionalIndex(c, b, count - mid - 1)];
  }

  // Generate a fractional index between a and b
  if (a && b && a >= b) {
    [a, b] = [b, a];
  }
  if (!a && !b) {
    return INTEGER_ZERO;
  }
  if (a) {
    validatestring(a, true);
  }
  if (b) {
    validatestring(b, false);
  }
  if (!a) {
    const ib = getIntegerPart(b!);
    const fb = b!.slice(ib.length);
    if (ib === SMALLEST_INTEGER) {
      return ib + midpoint('', fb);
    }
    return ib < b! ? ib : decrementInteger(ib)!;
  }
  if (!b) {
    const ia = getIntegerPart(a);
    const fa = a.slice(ia.length);
    const i = incrementInteger(ia);
    return !i ? ia + midpoint(fa, null) : i;
  }
  const ia = getIntegerPart(a);
  const fa = a.slice(ia.length);
  const ib = getIntegerPart(b);
  const fb = b.slice(ib.length);
  if (ia === ib) {
    return ia + midpoint(fa, fb);
  }
  const i = incrementInteger(ia);
  return i! < b ? i! : ia + midpoint(fa, null);
}
