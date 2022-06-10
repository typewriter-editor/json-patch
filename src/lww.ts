import { applyPatch } from '.';
import { toKeys } from './apply/utils';
import { isArrayPath } from './rebase/utils';
import { JSONPatchOp } from './types';

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
  receiveChange: (patch: JSONPatchOp[], rev?: number) => T;
  getChangesSince: (rev: number) => JSONPatchOp[];
  get(): T;
  getMeta(): LWWMetadata;
  getRev(): number;
  set(value: T, meta: LWWMetadata): void;
}

export interface LWWMetadata {
  rev: number;
  changed?: string[];
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
  let changed = new Set(meta.changed);
  let sending: Set<string> | null = null;

  const subscribers: Set<Subscriber<T>> = new Set();
  const patchSubscribers: Set<PatchSubscriber> = new Set();
  const changeSubscribers: Set<ChangeSubscriber> = new Set();
  const { whitelist, blacklist } = options;

  function makeChange(patch: JSONPatchOp[], autoCommit?: boolean): void {
    if (!autoCommit && (whitelist || blacklist)) {
      patch = patch.filter(patch => !(whitelist && !pathExistsIn(patch.path, whitelist) || blacklist && pathExistsIn(patch.path, blacklist)));
    }
    const result = applyPatch(object, patch, { strict: true });
    if (result === object || typeof result === 'string') return result;
    object = result;
    if (autoCommit) {
      setRev(patch, ++rev);
      patchSubscribers.forEach(subscriber => subscriber(patch, rev));
    } else {
      patch.forEach(op => addChange(op.path));
      changeSubscribers.forEach(subscriber => subscriber());
    }
  }

  function receiveChange(patch: JSONPatchOp[], rev_?: number) {
    const serverCommit = !rev_;
    if (serverCommit) {
      rev_ = rev + 1;
      setRev(patch, rev_);
    }
    rev = rev_ as number;

    // Filter out any patches that are in-flight being sent to the server as they will overwrite this change
    patch = patch.filter(patch => {
      const [ target ] = getTargetAndKey(patch.path);
      if (patch.op !== 'add' && patch.op !== 'remove' && patch.op !== 'replace') {
        throw new Error('Last-write-wins only works with add, remove and replace operations');
      } else if (isArrayPath(patch.path) && Array.isArray(target)) {
        throw new TypeError('Last-write-wins cannot be used with array entries');
      }
      if (isSending(patch.path)) return false;
      // Remove from changed if it's about to be overwritten (usually you should be sending changes before receiving them)
      if (changed.has(patch.path)) changed.delete(patch.path);
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
      object = applyPatch(object, patch, { strict: true });
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
      changes.push({ op: 'add', path: '', value: object });
    } else {
      for (const [ path, r ] of Object.entries(paths)) {
        if (r > rev) changes.push(getPatchOp(path));
      }
    }
    return changes;
  }

  async function sendChanges(sender: Sender): Promise<void> {
    if (!changed.size || sending) return;
    sending = changed;
    changed = new Set();
    const changes = Array.from(sending).map(path => getPatchOp(path));
    try {
      await sender(changes);
      sending = null;
    } finally {
      if (sending) {
        // Reset state on error to allow for another send
        changed = new Set([ ...sending, ...changed ]);
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
    return () => changeSubscribers.delete(run);
  }

  function get(): T {
    return object;
  }

  function getMeta(): LWWMetadata {
    const meta: LWWMetadata = { rev };
    if (changed.size) meta.changed = [ ...changed ];
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
    changed = new Set(meta.changed);
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

  function addChange(path: string) {
    // Filter out redundant paths such as removing /foo/bar/baz when /foo exists
    if (changed.has('')) return;
    if (path === '') {
      changed.clear();
      changed.add('');
    } else if (!pathExistsIn(path, changed)) {
      const prefix = `${path}/`;
      changed.forEach(path => path.startsWith(prefix) && changed.delete(path));
      changed.add(path);
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

  function getPatchOp(path: string): JSONPatchOp {
    if (path === '') return { op: 'add', path, value: object };
    const [ target, key ] = getTargetAndKey(path);
    if (target && key in target) {
      return { op: 'add', path, value: target[key] };
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
