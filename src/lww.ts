import { toKeys } from './apply/utils/toKeys';
import { JSONPatchOp } from './types';


export function getPatchesSince(object: any, timestamp: number): JSONPatchOp[] {
  const changes: JSONPatchOp[] = [];
  for (const [ path, ts ] of Object.entries(object.$lww$ as Timestamps)) {
    if (ts > timestamp) {
      const [ target, key ] = getTargetAndKey(object, path);
      if (target && key in target) {
        changes.push({ op: 'add', path, value: target[key] });
      } else {
        changes.push({ op: 'remove', path });
      }
      changes.push({ op: 'add', path: `/$lww$/${path.slice(1).replace(/\//g, '~1')}`, value: ts });
    }
  }
  return changes;
}

export function getLWW(initialValue?: Timestamps): LWW {
  const timestamps: Timestamps = { ...initialValue };

  function get(path: string): number {
    if (path[0] !== '/') throw new TypeError('paths must start with /');
    while (path) {
      if (path in timestamps) return timestamps[path] as number;
      path = path.slice(0, path.lastIndexOf('/'));
    }
    return timestamps[path] || 0;
  }

  function set(path: string, timestamp: number): Timestamps {
    if (path[0] !== '/') throw new TypeError('paths must start with /');
    const exceptions: Timestamps = {};
    for (const [ key, ts ] of Object.entries(timestamps)) {
      if (key.startsWith(path)) {
        if (ts < timestamp) {
          delete timestamps[key];
        } else {
          exceptions[key] = ts;
        }
      }
    }
    timestamps[path === '/' ? '' : path] = timestamp;
    return exceptions;
  }

  function toJSON() {
    return timestamps;
  }

  return { get, set, toJSON };
}


function getTargetAndKey(target: any, path: string): [any, string] {
  const keys = toKeys(path);
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

type Timestamps = Record<string, number>;

interface LWW {
  get(property: string): number;
  set(property: string, timestamp: number): Timestamps;
  toJSON(): Timestamps;
}
