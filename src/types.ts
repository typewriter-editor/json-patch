export interface ApplyJSONPatchOptions {
  partial?: boolean; // not reject patches if error occurs (partial patching)
  strict?: boolean; // throw an exception if error occurs
  error?: JSONPatchOp; // the patch that caused the error
  custom?: {
    [key: string]: JSONPatchCustomHandler; // custom operator definition
  };
  [key: string]: any; // custom options
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

export type OperationHandler = (path: string, value: any, from: string) => string | void;
export type JSONPatchCustomHandler = (api: API, patch: JSONPatchOp, i: number, patches: JSONPatchOp[]) =>  string | void;

export interface API {
  get: (path: any) => any;
  add: (path: any, value: any) => string | void;
  remove: (path: any) => string | void;
  replace: (path: any, value: any) => string | void;
  move: (from: any, path: any) => string | void;
  copy: (from: any, path: any) => string | void;
  test: (path: any, expected: any) => string | void;
  deepEqual: (a: any, b: any) => boolean;
  shallowCopy: (obj: any) => any;
  pluck: (keys: string[]) => any;
  pluckWithShallowCopy: (keys: string[]) => any;
  toKeys: (path: string) => string[];
}
