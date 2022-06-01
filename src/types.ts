export interface JSONPatchCustomType {
  apply?: ApplyHandler;
  rebase?: RebaseHandler;
  invert?: InvertHandler;
}

export interface JSONPatchCustomTypes {
  [key: string]: JSONPatchCustomType;
}

export interface ApplyJSONPatchOptions {
  partial?: boolean; // do not reject patches if error occurs (partial patching)
  strict?: boolean; // throw an exception if error occurs when patching
  rigid?: boolean; // stop on error and return the original object
  silent?: boolean; // don't log errors when they occurs during patching
  error?: JSONPatchOp; // saves the patch that caused the error
  atPath?: string; // apply changes at a given path prefix
  // to use last-write-wins when patching an object, pass in the timestamp of this change as milliseconds since epoch
  // and timestamp metadata will be tracked with the object and used to know the last timestamp of each property
  timestamp?: number;
}

export interface JSONPatchOp {
  op: string;
  path: string;
  from?: string;
  value?: any;
}

export interface Root {
  '': any;
}

export type ApplyHandler = (path: string, value: any, from: string) => string | void;
export type RebaseHandler = (over: JSONPatchOp, ops: JSONPatchOp[]) => JSONPatchOp[];
export type InvertHandler = (op: JSONPatchOp, value: any, changedObj: any, isIndex: boolean) => JSONPatchOp;
