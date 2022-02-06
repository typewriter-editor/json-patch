/*!
 * Based on work from
 * https://github.com/mohayonao/json-touch-patch
 * (c) 2018 mohayonao
 *
 * MIT license
 * (c) 2022 Jacob Wright
 *
 *
 * NOTE: using /array/- syntax to indicate the end of the array makes it impossible to rebase arrays correctly in all
 */

import type { JSONPatchOp, JSONPatchCustomTypes, ApplyJSONPatchOptions } from './types';
import { applyPatch } from './applyPatch';
import { rebasePatch } from './rebasePatch';
import { invertPatch } from './invertPatch';



/**
 * A JSONPatch helps with creating and applying one or more "JSON patches". It can track one or more changes
 * together which may form a single operation or transaction.
 */
export class JSONPatch {
  ops: JSONPatchOp[];
  types: JSONPatchCustomTypes

  /**
   * Create a new JSONPatch, optionally with an existing array of operations.
   */
  constructor(ops: JSONPatchOp[] = [], types: JSONPatchCustomTypes = {}) {
    this.ops = ops;
    this.types = types;
  }

  op(op: string, path: string, value?: any, from?: string) {
    checkPath(path);
    const patchOp: JSONPatchOp = { op, path };
    if (from !== undefined) {
      checkPath(from);
      patchOp.from = from;
    }
    if (value !== undefined) patchOp.value = value;
    this.ops.push(patchOp);
    return this;
  }

  /**
   * Tests a value exists. If it doesn't, the patch is not applied.
   */
  test(path: string, value: any) {
    return this.op('test', path, value);
  }

  /**
   * Adds the value to an object or array, inserted before the given index.
   */
  add(path: string, value: any) {
    if (value && value.toJSON) value = value.toJSON();
    return this.op('add', path, value);
  }

  /**
   * Deletes the value at the given path or removes it from an array.
   */
  remove(path: string) {
    return this.op('remove', path);
  }

  /**
   * Replaces a value (same as remove+add).
   */
  replace(path: string, value: any) {
    return this.op('replace', path, value);
  }

  /**
   * Copies the value at `from` to `path`.
   */
  copy(from: string, path: string) {
    return this.op('copy', from, path);
  }

  /**
   * Moves the value at `from` to `path`.
   */
  move(from: string, path: string) {
    return this.op('move', from, path);
  }

  /**
   * Creates a patch from an object partial, updating each field. Set a field to undefined to delete it.
   */
  addUpdates(updates: {[key: string]: any}, path = '/') {
    if (path[path.length -1] !== '/') path += '/';
    Object.keys(updates).forEach(key => {
      const value = updates[key];
      if (value === undefined) {
        this.remove(path + key);
      } else {
        this.add(path + key, value);
      }
    });
    return this;
  }

  /**
   * This will ensure an "add empty object" operation is created for each property along the path that does not exist.
   */
  addObjectsInPath(obj: any, path: string) {
    checkPath(path);
    const parts = path.split('/');
    for (var i = 1; i < parts.length - 1; i++) {
      const prop = parts[i];
      if (!obj || !obj[prop]) {
        this.add(parts.slice(0, i + 1).join('/'), {});
      }
      obj = obj && obj[prop];
    }
    return this;
  }

  /**
   * Apply this patch to an object, returning a new object with the applied changes (or the same object if nothing
   * changed in the patch). Optionally apply the page at the given path prefix.
   */
  patch<T>(obj: T, options: ApplyJSONPatchOptions): T {
    return applyPatch(obj, this.ops, options, this.types);
  }

  /**
   * Rebase this patch against another JSONPatch or array of operations
   */
  rebase(over: JSONPatch | JSONPatchOp[]) {
    return new JSONPatch(rebasePatch(this.ops, Array.isArray(over) ? over : over.ops, this.types));
  }

  /**
   * Create a patch which can reverse what this patch does. Because JSON Patches do not store previous values, you
   * must provide the previous object to create a reverse patch.
   */
  invert(object: any) {
    return new JSONPatch(invertPatch(object, this.ops, this.types));
  }

  revert(object: any) {
    return this.invert(object);
  }

  /**
   * Returns an array of patch operations.
   */
  toJSON() {
    return this.ops.slice();
  }

  /**
   * Create a new JSONPatch with the provided JSON patch operations.
   */
  static fromJSON(ops: any) {
    return new JSONPatch(ops as JSONPatchOp[]);
  }
}

function checkPath(path: string) {
  if (path.length && path[0] !== '/') throw new TypeError('JSON Patch paths must begin with "/"');
}
