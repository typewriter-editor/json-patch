import { applyPatch } from './applyPatch';
import { toKeys } from './apply/utils';
import { isArrayPath } from './rebase/utils';
import { JSONPatchOp } from './types';
import { increment } from './custom-types/increment';

export type Subscriber<T> = (value: T, meta: SyncableMetadata, hasUnsentChanges: boolean) => void;
export type PatchSubscriber = (value: JSONPatchOp[], rev: number) => void;
export type Unsubscriber = () => void;
export type Sender<T> = (changes: JSONPatchOp[]) => Promise<T>;

export interface SyncableClient<T = Record<string, any>> {
  subscribe: (run: Subscriber<T>) => Unsubscriber;
  change: (patch: JSONPatchOp[]) => T;
  receive: (patch: JSONPatchOp[], rev: number, overwriteChanges?: boolean) => T;
  send<T>(sender: Sender<T>): Promise<T | void>;
  get(): T;
  getMeta(): SyncableMetadata;
  getRev(): number;
  set(value: T, meta: SyncableMetadata): void;
}

export interface SyncableServer<T = Record<string, any>> {
  onPatch: (run: (value: JSONPatchOp[], rev: number) => void) => Unsubscriber;
  subscribe: (run: Subscriber<T>) => Unsubscriber;
  change: (patch: JSONPatchOp[]) => [ JSONPatchOp[], number ];
  receive: (patch: JSONPatchOp[]) => [ JSONPatchOp[], number ];
  changesSince: (rev: number) => JSONPatchOp[];
  get(): T;
  getMeta(): SyncableMetadata;
  getRev(): number;
  set(value: T, meta: SyncableMetadata): void;
}

export type Changes = Record<string,number>;

export interface SyncableMetadata {
  rev: number;
  changed?: Changes;
  paths?: {
    [key: string]: number;
  }
}

export type SyncableOptions = {
  whitelist?: Set<string>;
  blacklist?: Set<string>;
}

export type SyncableServerOptions = {
  server: true;
  whitelist?: Set<string>;
  blacklist?: Set<string>;
}

export function syncable<T>(object: T, meta?: SyncableMetadata, options?: SyncableOptions): SyncableClient<T>;
export function syncable<T>(object: T, meta: SyncableMetadata | undefined, options: SyncableServerOptions): SyncableServer<T>;
export function syncable<T>(object: T, meta: SyncableMetadata = { rev: 0 }, options: SyncableOptions = {}): SyncableClient<T> & SyncableServer<T> {
  let rev = meta.rev;
  let paths = meta.paths || {};
  let changed = { ...meta.changed };
  let sending: Set<string> | null = null;
  meta = getMeta();

  const types = { '@inc': increment };
  const subscribers: Set<Subscriber<T>> = new Set();
  const patchSubscribers: Set<PatchSubscriber> = new Set();
  const { whitelist, blacklist, server } = options as SyncableServerOptions;

  function change(patch: JSONPatchOp[]) {
    // If server is true, this is an admin operation on the server which will bypass the blacklists/whitelists
    if (!server) {
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
    if (result === object) return result; // no changes made
    object = result;
    if (server) setRev(patch, ++rev)
    else patch.forEach(op => addChange(op));
    return dispatchChanges(patch);
  }

  // This method is necessary to track in-flight sent properties to avoid property flickering described here:
  // https://www.figma.com/blog/how-figmas-multiplayer-technology-works/#syncing-object-properties.
  async function send<T>(sender: Sender<T>): Promise<T | void> {
    if (!Object.keys(changed).length || sending) return;
    sending = new Set(Object.keys(changed));
    const oldChangedObj = changed;
    changed = {};
    const changes = Array.from(sending).map(path => getPatchOp(path, oldChangedObj[path]));
    let result: any;
    try {
      result = await sender(changes);
      sending = null;
    } finally {
      if (sending) {
        // Reset state on error to allow for another send
        changed = Object.keys({ ...oldChangedObj, ...changed }).reduce((obj, key) => {
          obj[key] = (oldChangedObj[key] || 0) + (changed[key] || 0);
          return obj;
        }, {} as Changes);
        sending = null;
      }
    }
    return result;
  }

  function receive(patch: JSONPatchOp[], rev_?: number, overwriteChanges?: boolean) {
    // If no rev, this is a server commit from a client and will autoincrement the rev.
    if (server) {
      rev_ = rev + 1;
      setRev(patch, rev_);
    } else if (!rev_) {
      throw new Error('Received a patch without a rev');
    } else if (rev_ <= rev) {
      // Already have the latest revision
      return object;
    }
    rev = rev_ as number;

    patch = patch.filter(patch => {
      // Filter out any patches that are in-flight being sent to the server as they will overwrite this change
      if (isSending(patch.path)) return false;
      // Remove from changed if it's about to be overwritten (usually you should be sending changes immediately)
      if (overwriteChanges && patch.path in changed) delete changed[patch.path];
      else if (changed[patch.path] && typeof patch.value === 'number') {
        patch.value += changed[patch.path]; // Adjust the value by our outstanding increment changes
      }
      return true;
    });

    if (server && (whitelist || blacklist)) {
      patch = patch.map(patch => {
        if (whitelist && !pathExistsIn(patch.path, whitelist) || blacklist && pathExistsIn(patch.path, blacklist)) {
          return getPatchOp(patch.path);
        }
        return patch;
      });
    }

    const result = applyPatch(object, patch, { strict: true }, types);
    if (result === object) return result; // no changes made
    object = result;
    return dispatchChanges(patch);
  }

  function changesSince(rev: number): JSONPatchOp[] {
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

  function subscribe(run: Subscriber<T>): Unsubscriber {
    subscribers.add(run);
    run(object, meta, Object.keys(changed).length > 0);
    return () => subscribers.delete(run);
  }

  function onPatch(run: PatchSubscriber): Unsubscriber {
    patchSubscribers.add(run);
    return () => patchSubscribers.delete(run);
  }

  function get(): T {
    return object;
  }

  function getMeta(): SyncableMetadata {
    const meta: SyncableMetadata = { rev };
    if (Object.keys(changed).length) meta.changed = { ...changed };
    if (Object.keys(paths).length) meta.paths = paths;
    return meta;
  }

  function getRev(): number {
    return rev;
  }

  function set(value: T, meta: SyncableMetadata): void {
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
    return rev;
  }

  function dispatchChanges(patch: JSONPatchOp[]) {
    const thisRev = rev;
    meta = getMeta();
    subscribers.forEach(subscriber => subscriber(object, meta, !server && Object.keys(changed).length > 0));
    if (server) {
      patch = patch.map(patch => patch.op[0] === '@' ? getPatchOp(patch.path) : patch);
      Promise.resolve().then(() => patchSubscribers.forEach(onPatch => onPatch(patch, thisRev)));
      return [ patch, thisRev ];
    }
    return object;
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

  return { subscribe, onPatch, change, send, receive, changesSince, get, getMeta, getRev, set };
}
