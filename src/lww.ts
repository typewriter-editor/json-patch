import { toKeys } from './apply/utils/toKeys';
import { JSONPatchOp } from './types';

export function lwwDiffs(object1: any, object2: any) {
  const changes1: JSONPatchOp[] = [];
  const changes2: JSONPatchOp[] = [];
  const lww1 = getLWW(object1);
  const lww2 = getLWW(object2);
  const prefixes1 = new Set<string>();
  const prefixes2 = new Set<string>();
  const keys = Object.keys({ ...object1.$lww$, ...object2.$lww$ }).sort((a, b) => a[0].length - b[0].length);
  for (const path of keys) {
    const ts1 = lww1.get(path);
    const ts2 = lww2.get(path);
    if (ts1 === ts2) continue;
    if (ts1 < ts2) {
      if (!pathExistsIn(path, prefixes1)) {
        changes1.push(getPatchOp(object2, path, ts2));
        prefixes1.add(path);
      }
    } else {
      if (!pathExistsIn(path, prefixes2)) {
        changes2.push(getPatchOp(object1, path, ts1));
        prefixes2.add(path);
      }
    }
  }
  return [ changes1, changes2 ];
}

export function getLWW(object: any): LWW {
  const timestamps: Timestamps = { ...(object && object.$lww$) };

  function get(path: string): number {
    if (path.length && path[0] !== '/') throw new TypeError('paths must start with /');
    while (path) {
      if (path in timestamps) return timestamps[path] as number;
      path = path.slice(0, path.lastIndexOf('/'));
    }
    return timestamps[path] || 0;
  }

  function set(path: string, timestamp: number): JSONPatchOp[] {
    if (path.length && path[0] !== '/') throw new TypeError('paths must start with /');
    const exceptions: JSONPatchOp[] = [];
    const prefix = `${path}/`;
    for (const [ key, ts ] of Object.entries(timestamps)) {
      if (path && key.startsWith(prefix)) {
        if (ts < timestamp) {
          delete timestamps[key];
        } else {
          exceptions.push(getPatchOp(object, key));
        }
      }
    }
    timestamps[path] = timestamp;
    return exceptions;
  }

  function toJSON() {
    return timestamps;
  }

  return { get, set, toJSON };
}


function getTargetAndKey(object: any, path: string): [any, string] {
  const keys = toKeys(path);
  for (let i = 1, imax = keys.length - 1; i < imax; i++) {
    const key = keys[i];
    if (!object[key]) {
      object = null;
      break;
    }
    object = object[key];
  }
  return [ object, keys[keys.length - 1] ];
}

function getPatchOp(object: any, path: string, ts?: number): JSONPatchOp {
  const [ target, key ] = getTargetAndKey(object, path);
  if (target && key in target) {
    return { op: 'add', path, value: target[key], ts };
  } else {
    return { op: 'remove', path, ts };
  }
}

function pathExistsIn(path: string, prefixes: Set<string>): boolean {
  while (path) {
    if (prefixes.has(path)) return true;
    path = path.slice(0, path.lastIndexOf('/'));
  }
  return false;
}

type Timestamps = Record<string, number>;

export interface LWW {
  get(property: string): number;
  set(property: string, timestamp: number): JSONPatchOp[];
  toJSON(): Timestamps;
}
