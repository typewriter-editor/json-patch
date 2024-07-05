export { applyPatch } from './applyPatch';
export { composePatch } from './composePatch';
export * from './fractionalIndex';
export { invertPatch } from './invertPatch';
export { JSONPatch } from './jsonPatch';
export * as defaultOps from './ops';
export * from './syncable';
export { transformPatch } from './transformPatch';

export { changeTextDelta } from './custom/delta';
export { changeTextTextDocument } from './custom/text-document';

export type { ApplyJSONPatchOptions, JSONPatchOpHandlerMap as JSONPatchCustomTypes, JSONPatchOp } from './types';
