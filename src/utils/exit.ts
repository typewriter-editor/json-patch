import type { ApplyJSONPatchOptions, JSONPatchOp, State } from '../types';

export function exit(state: State, object: any, patch: JSONPatchOp, opts: ApplyJSONPatchOptions) {
  opts.error = patch;
  return opts.partial && state.root ? state.root[''] : object;
}
