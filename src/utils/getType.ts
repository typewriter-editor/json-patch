import type { JSONPatchOp, JSONPatchOpHandlerMap } from '../types';
import * as defaultTypes from './ops';

export function getType(patch: JSONPatchOp, custom?: JSONPatchOpHandlerMap) {
  return custom?.[patch.op] || (defaultTypes as any as JSONPatchOpHandlerMap)[patch.op];
}
