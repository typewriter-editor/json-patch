import { get } from '../ops/get';
import { add } from '../ops/add';
import { remove } from '../ops/remove';
import { replace } from '../ops/replace';
import { move } from '../ops/move';
import { copy } from '../ops/copy';
import { test } from '../ops/test';
import { deepEqual } from './deepEqual';
import { shallowCopy } from './shallowCopy';
import { toKeys } from './toKeys';
import { pluck, pluckWithShallowCopy } from './pluck';
import type { API } from '../types';

export const api: API = {
  get,
  add,
  remove,
  replace,
  move: (from: string, path: string) => move(path, null, from),
  copy: (from: string, path: string) => copy(path, null, from),
  test,
  deepEqual: deepEqual,
  shallowCopy: shallowCopy,
  pluck,
  pluckWithShallowCopy,
  toKeys: toKeys,
};