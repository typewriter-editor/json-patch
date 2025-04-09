import type { JSONPatchOpHandlerMap } from '../types.js';
import { add } from './add.js';
import { bit } from './bitmask.js';
import { copy } from './copy.js';
import { textDelta } from './delta.js';
import { increment } from './increment.js';
import { move } from './move.js';
import { remove } from './remove.js';
import { replace } from './replace.js';
import { test } from './test.js';

export * from './bitmask.js';
export { add, bit, copy, increment, move, remove, replace, test };

export function getTypes(custom?: JSONPatchOpHandlerMap) {
  return {
    test,
    add,
    remove,
    replace,
    copy,
    move,
    '@inc': increment,
    '@bit': bit,
    '@text': textDelta,
    ...custom,
  };
}
