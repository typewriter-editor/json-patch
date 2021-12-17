import { get } from './get';
import { add } from './add';
import { remove } from './remove';
import { replace } from './replace';
import { move } from './move';
import { copy } from './copy';
import { test } from './test';
import type { OperationHandler } from '../types';

export const ops: {[name: string]: OperationHandler} = {
  get,
  add,
  remove,
  replace,
  move,
  copy,
  test,
};
