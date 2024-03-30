
export interface JSONPatchOpHandler {
  like: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
  apply(state: State, path: string, value: any, from?: string, createMissingObjects?: boolean): string | void;
  transform(state: State, other: JSONPatchOp, ops: JSONPatchOp[]): JSONPatchOp[];
  invert(state: State, op: JSONPatchOp, value: any, changedObj: any, isIndex: boolean): JSONPatchOp;
  compose?(state: State, value1: any, value2: any): any;
}

export interface JSONPatchOpHandlerMap {
  [key: string]: JSONPatchOpHandler;
}

export interface ApplyJSONPatchOptions {
  /**
   * Do not reject patches if error occurs (partial patching)
   */
  partial?: boolean;

  /**
   * Throw an exception if an error occurs when patching
   */
  strict?: boolean;

  /**
   * Stop on error and return the original object (without throwing an exception)
   */
  rigid?: boolean;

  /**
   * Don't log errors when they occurs during patching, if strict is not true, errors will be logged if this is false
   */
  silent?: boolean;

  /**
   * Saves the patch that caused the error to this property of the options object
   */
  error?: JSONPatchOp;

  /**
   * Apply changes at a given path prefix
   */
  atPath?: string;

  /**
   * Create empty objects when a path needs them to resolve
   */
  createMissingObjects?: boolean;
}

export interface JSONPatchOp {
  op: string;
  path: string;
  from?: string;
  value?: any;
  soft?: boolean; // extension to JSON Patch to prevent an operation from overwriting existing data
}

export interface Root {
  '': any;
}

export type State = {
  root: Root;
  types: JSONPatchOpHandlerMap;
  cache: Set<any> | null;
};

export type Runner = (state: State) => any;
