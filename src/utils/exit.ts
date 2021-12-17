import { root } from '../state';
import type { Options, Patch } from '../types';

export function exit(object: any, patch: Patch, opts: Options) {
  opts.error = patch;
  return opts.partial && root ? root[''] : object;
}
