import type { JSONPatchOpHandlerMap, Runner, State } from './types.js';

export function runWithObject(object: any, allTypes: JSONPatchOpHandlerMap, shouldCache: boolean, callback: Runner) {
  const state: State = {
    root: { '': object },
    types: allTypes,
    cache: shouldCache ? new Set() : null,
  };
  return callback(state) || state.root[''];
}
