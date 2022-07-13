export interface JSONPatchOpHandler {
  apply(path: string, value: any, from?: string): string | void;
  transform(other: JSONPatchOp, ops: JSONPatchOp[], priority: boolean): JSONPatchOp[];
  invert(op: JSONPatchOp, value: any, changedObj: any, isIndex: boolean): JSONPatchOp;
  compose?(op1: JSONPatchOp, op2: JSONPatchOp): any;
}

export interface JSONPatchOpHandlerMap {
  [key: string]: JSONPatchOpHandler;
}

export interface ApplyJSONPatchOptions {
  partial?: boolean; // do not reject patches if error occurs (partial patching)
  strict?: boolean; // throw an exception if error occurs when patching
  rigid?: boolean; // stop on error and return the original object
  silent?: boolean; // don't log errors when they occurs during patching
  error?: JSONPatchOp; // saves the patch that caused the error
  atPath?: string; // apply changes at a given path prefix
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
