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
  getChangesSince: (rev: number) => JSONPatchOp[];
  sendChanges(sender: Sender): Promise<void>;
  get(): T;
  getMeta(): LWWMetadata;
}
export interface LWWServer<T = Record<string, any>> {
  subscribe: (run: Subscriber<T>) => Unsubscriber;
  onPatch: (run: (value: JSONPatchOp[], rev: number) => void) => Unsubscriber;
  makeChange: (patch: JSONPatchOp[], autoCommit: true) => void;
  receiveChange: (patch: JSONPatchOp[], rev?: number) => T;
  getChangesSince: (rev: number) => JSONPatchOp[];
  get(): T;
  getMeta(): LWWMetadata;
}


export function lwwClient<T>(object: T, meta?: LWWMetadata): LWWClient<T> {
  return lww(object, meta);
}
export function lwwServer<T>(object: T, meta?: LWWMetadata): LWWServer<T> {
  return lww(object, meta);
}

function lww<T>(object: T, { rev, paths, changed = new Set(), sending = new Set() }: LWWMetadata = { rev: 0, paths: {} }): LWWClient<T> & LWWServer<T> {
  const subscribers: Set<Subscriber<T>> = new Set();
  const patchSubscribers: Set<PatchSubscriber> = new Set();
  const changeSubscribers: Set<ChangeSubscriber> = new Set();

  function makeChange(patch: JSONPatchOp[], autoCommit?: boolean): void {
    const result = applyPatch(object, patch, { strict: true });
    if (result === object || typeof result === 'string') return result;
    object = result;
    if (autoCommit) {
      setRev(patch, ++rev);
      patchSubscribers.forEach(subscriber => subscriber(patch, rev));
    } else {
      patch.forEach(op => changed.add(op.path));
      changeSubscribers.forEach(subscriber => subscriber());
    }
  }

  function receiveChange(patch: JSONPatchOp[], rev_?: number) {
    // Filter out any patches that are in-flight being sent to the server as they will overwrite this change
    rev = rev_ || rev + 1;
    setRev(patch, rev);
    patch = patch.filter(patch => {
      const [ target ] = getTargetAndKey(patch.path);
      if (patch.op !== 'add' && patch.op !== 'remove' && patch.op !== 'replace') {
        throw new Error('Last-write-wins only works with add, remove and replace operations');
      } else if (isArrayPath(patch.path) && Array.isArray(target)) {
        throw new TypeError('Last-write-wins cannot be used with array entries');
      }
      return !isSending(patch.path);
    });
    if (patch.length) {
      object = applyPatch(object, patch, { strict: true });
      Promise.resolve().then(() => patchSubscribers.forEach(subscriber => subscriber(patch, rev)));
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
    if (!changed.size || sending.size) return;
    sending = changed;
    changed = new Set();
    const changes = Array.from(sending).map(path => getPatchOp(path));
    try {
      await sender(changes);
      sending = new Set();
    } finally {
      if (sending.size) {
        // Reset state on error to allow for another send
        changed = new Set([ ...sending, ...changed ]);
        sending = new Set();
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
    return { rev, paths, changed, sending };
  }

  function setRev(patch: JSONPatchOp[], rev: number) {
    patch.map(op => op.path).sort((a, b) => b.length - a.length).forEach(path => {
      const prefix = `${path}/`;
      for (const key of Object.keys(paths)) {
        if (path && key.startsWith(prefix)) {
          delete paths[key];
        }
      }
      paths[path] = rev
    });
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

  return { subscribe, onPatch, makeChange, onMakeChange, receiveChange, getChangesSince, sendChanges, get, getMeta };
}


export interface LWWMetadata {
  rev: number;
  changed?: Set<string>;
  sending?: Set<string>;
  paths: {
    [key: string]: number;
  }
}
