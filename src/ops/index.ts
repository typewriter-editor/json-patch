import { JSONPatchOpHandlerMap } from '../types';
import { add } from './add';
import { copy } from './copy';
import { increment } from './increment';
import { move } from './move';
import { remove } from './remove';
import { replace } from './replace';
import { test } from './test';

export { add, copy, increment, move, remove, replace, test };

export function getTypes(custom?: JSONPatchOpHandlerMap) {
  return {
    test, add, remove, replace, copy, move, '@inc': increment, ...custom
  }
}
