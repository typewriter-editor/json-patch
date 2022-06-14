import { applyPatch } from './applyPatch';
import { toKeys } from './apply/utils';
import { isArrayPath } from './rebase/utils';
import { JSONPatchOp } from './types';
import { increment } from './custom-types/increment';

export type Subscriber<T> = (value: T) => void;
export type PatchSubscriber = (value: JSONPatchOp[], rev: number) => void;
export type ChangeSubscriber = () => void;
export type Unsubscriber = () => void;
export type Sender = (changes: JSONPatchOp[]) => Promise<unknown>;

export interface LWWClient<T = Record<string, any>> {
  subscribe: (run: Subscriber<T>) => Unsubscriber;
  makeChange: (patch: JSONPatchOp[]) => void;
  onMakeChange: (run: () => void) => Unsubscriber;
  receiveChange: (patch: JSONPatchOp[], rev: number) => T;
  sendChanges(sender: Sender): Promise<void>;
  get(): T;
  getMeta(): LWWMetadata;
  getRev(): number;
  set(value: T, meta: LWWMetadata): void;
}

export interface LWWServer<T = Record<string, any>> {
  subscribe: (run: Subscriber<T>) => Unsubscriber;
  onPatch: (run: (value: JSONPatchOp[], rev: number) => void) => Unsubscriber;
  makeChange: (patch: JSONPatchOp[], autoCommit: true) => void;
  receiveChange: (patch: JSONPatchOp[]) => T;
  getChangesSince: (rev: number) => JSONPatchOp[];
  get(): T;
  getMeta(): LWWMetadata;
  getRev(): number;
  set(value: T, meta: LWWMetadata): void;
}

export type Changes = Record<string,number>;

export interface LWWMetadata {
  rev: number;
  changed?: Changes;
  paths?: {
    [key: string]: number;
  }
}

export interface LWWOptions {
  whitelist?: Set<string>;
  blacklist?: Set<string>;
}

export function lwwClient<T>(object: T, meta?: LWWMetadata, options?: LWWOptions): LWWClient<T> {
  return lww(object, meta, options);
}
export function lwwServer<T>(object: T, meta?: LWWMetadata, options?: LWWOptions): LWWServer<T> {
  return lww(object, meta, options);
}

function lww<T>(object: T, meta: LWWMetadata = { rev: 0 }, options: LWWOptions = {}): LWWClient<T> & LWWServer<T> {
  let rev = meta.rev;
  let paths = meta.paths || {};
  let changed = { ...meta.changed };
  let sending: Set<string> | null = null;

  const types = { '@inc': increment };
  const subscribers: Set<Subscriber<T>> = new Set();
  const patchSubscribers: Set<PatchSubscriber> = new Set();
  const changeSubscribers: Set<ChangeSubscriber> = new Set();
  const { whitelist, blacklist } = options;

  function makeChange(patch: JSONPatchOp[], autoCommit?: boolean): void {
    // If autoCommit is true, this is an admin operation on the server which will bypass the blacklists/whitelists
    if (!autoCommit) {
      patch.forEach(patch => {
        if (whitelist && !pathExistsIn(patch.path, whitelist)) {
          throw new TypeError(`${patch.path} is not a whitelisted property for LWW Object`);
        }
        if (blacklist && pathExistsIn(patch.path, blacklist)) {
          throw new TypeError(`${patch.path} is a blacklisted property for LWW Object`);
        }
        const [ target ] = getTargetAndKey(patch.path);
        if (isArrayPath(patch.path) && Array.isArray(target)) {
          throw new TypeError('Last-write-wins cannot be used with array entries');
        }
      });
    }
    const result = applyPatch(object, patch, { strict: true }, types);
    if (result === object || typeof result === 'string') return result;
    object = result;
    if (autoCommit) {
      setRev(patch, ++rev);
      patchSubscribers.forEach(subscriber => subscriber(patch, rev));
    } else {
      patch.forEach(op => addChange(op));
      changeSubscribers.forEach(subscriber => subscriber());
    }
  }

  function receiveChange(patch: JSONPatchOp[], rev_?: number) {
    // If no rev, this is a server commit from a client and will autoincrement the rev.
    const serverCommit = !rev_;
    if (!rev_) {
      rev_ = rev + 1;
      setRev(patch, rev_);
    } else if (rev_ <= rev) {
      // Already have the latest revision
      return object;
    }
    rev = rev_ as number;

    patch = patch.filter(patch => {
      // Filter out any patches that are in-flight being sent to the server as they will overwrite this change
      if (isSending(patch.path)) return false;
      // Remove from changed if it's about to be overwritten (usually you should be sending changes immediately)
      if (changed[patch.path]) delete changed[patch.path];
      return true;
    });

    if (serverCommit && (whitelist || blacklist)) {
      patch = patch.map(patch => {
        if (whitelist && !pathExistsIn(patch.path, whitelist) || blacklist && pathExistsIn(patch.path, blacklist)) {
          return getPatchOp(patch.path);
        }
        return patch;
      });
    }

    if (patch.length) {
      object = applyPatch(object, patch, { strict: true }, types);
      patch = patch.map(patch => patch.op[0] === '@' ? getPatchOp(patch.path) : patch);
      Promise.resolve().then(() =>
        Promise.resolve().then(() =>
          patchSubscribers.forEach(subscriber => subscriber(patch, rev_ as number))
        )
      );
    }
    return object;
  }

  function getChangesSince(rev: number): JSONPatchOp[] {
    const changes: JSONPatchOp[] = [];
    if (!rev) {
      changes.push({ op: 'replace', path: '', value: object });
    } else {
      for (const [ path, r ] of Object.entries(paths)) {
        if (r > rev) changes.push(getPatchOp(path));
      }
    }
    return changes;
  }

  async function sendChanges(sender: Sender): Promise<void> {
    if (!Object.keys(changed).length || sending) return;
    sending = new Set(Object.keys(changed));
    const oldChangedObj = changed;
    changed = {};
    const changes = Array.from(sending).map(path => getPatchOp(path, oldChangedObj[path]));
    try {
      await sender(changes);
      sending = null;
    } finally {
      if (sending) {
        // Reset state on error to allow for another send
        changed = Object.keys({ ...oldChangedObj, ...changed }).reduce((obj, key) =>
          (oldChangedObj[key] || 0) + (changed[key] || 0), {});
        sending = null;
      }
    }
  }

  function subscribe(run: Subscriber<T>): Unsubscriber {
    subscribers.add(run);
    run(object);
    return () => subscribers.delete(run);
  }

  function onPatch(run: PatchSubscriber): Unsubscriber {
    patchSubscribers.add(run);
    return () => patchSubscribers.delete(run);
  }

  function onMakeChange(run: ChangeSubscriber): Unsubscriber {
    changeSubscribers.add(run);
    if (Object.keys(changed).length) run();
    return () => changeSubscribers.delete(run);
  }

  function get(): T {
    return object;
  }

  function getMeta(): LWWMetadata {
    const meta: LWWMetadata = { rev };
    if (Object.keys(changed).length) meta.changed = { ...changed };
    if (Object.keys(paths).length) meta.paths = paths;
    return meta;
  }

  function getRev(): number {
    return rev;
  }

  function set(value: T, meta: LWWMetadata): void {
    object = value;
    rev = meta.rev;
    paths = meta.paths || {};
    changed = meta.changed || {};
    sending = null;
  }

  function setRev(patch: JSONPatchOp[], rev: number) {
    patch.map(op => op.path).sort((a, b) => b.length - a.length).forEach(path => {
      const prefix = `${path}/`;
      for (const key of Object.keys(paths)) {
        if (path && key.startsWith(prefix)) {
          delete paths[key];
        }
      }
      paths[path] = rev;
    });
  }

  function addChange(op: JSONPatchOp) {
    // Filter out redundant paths such as removing /foo/bar/baz when /foo exists
    if (changed[''] && op.op !== '@inc') return;
    if (op.path === '') {
      changed = { '': 0 };
    } else {
      const prefix = `${op.path}/`;
      Object.keys(changed).forEach(path => path.startsWith(prefix) && delete (changed[path]));
      if (op.op === '@inc') {
        const value = op.value + (changed[op.path] || 0);
        // a 0 increment is nothing, so delete it, we're using 0 to indicated other fields that have been changed
        if (!value) delete changed[op.path];
        else changed[op.path] = value;
      } else if (op.op !== 'test') {
        if (op.op === 'move') changed[op.from as string] = 0;
        changed[op.path] = 0;
      }
    }
  }

  function isSending(path: string): boolean {
    return !!(sending && pathExistsIn(path, sending));
  }

  function pathExistsIn(path: string, prefixes: Set<string>): boolean {
    while (path) {
      if (prefixes.has(path)) return true;
      path = path.slice(0, path.lastIndexOf('/'));
    }
    return false;
  }

  function getPatchOp(path: string, value?: number): JSONPatchOp {
    if (path === '') return { op: 'replace', path, value: object };
    const [ target, key ] = getTargetAndKey(path);
    if (value) {
      return { op: '@inc', path, value };
    } else if (target && key in target) {
      return { op: 'replace', path, value: target[key] };
    } else {
      return { op: 'remove', path };
    }
  }

  function getTargetAndKey(path: string): [any, string] {
    const keys = toKeys(path);
    let target = object as any;
    for (let i = 1, imax = keys.length - 1; i < imax; i++) {
      const key = keys[i];
      if (!target[key]) {
        target = null;
        break;
      }
      target = target[key];
    }
    return [ target, keys[keys.length - 1] ];
  }

  return { subscribe, onPatch, makeChange, onMakeChange, receiveChange, getChangesSince, sendChanges, get, getMeta, getRev, set };
}
