export { applyPatch } from './applyPatch.js';
export { composePatch } from './composePatch.js';
export * from './fractionalIndex.js';
export { invertPatch } from './invertPatch.js';
export * from './jsonPatch.js';
export { applyBitmask, bitmask, combineBitmasks } from './ops/bitmask.js';
export * as defaultOps from './ops/index.js';
export * from './syncable.js';
export { transformPatch } from './transformPatch.js';

import { textDelta } from './custom/delta.js';
import { textDocument } from './custom/text-document.js';

export { textDelta as changeTextDelta, textDocument as changeTextTextDocument, textDelta, textDocument };

export * from './ops/index.js';
export type { ApplyJSONPatchOptions, JSONPatchOpHandlerMap as JSONPatchCustomTypes, JSONPatchOp } from './types.js';
