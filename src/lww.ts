import { patchWith } from './apply/state';
import { getOpData } from './apply/utils';
import { JSONPatchOp } from './types';


export function getPatchesSince(object: any, timestamp: number): JSONPatchOp[] {
  const changes: JSONPatchOp[] = [];
  patchWith(object, false, () => {
    for (const [ path, ts ] of Object.entries(object.$lww$ as Timestamps)) {
      if (ts > timestamp) {
        const [ keys, lastKey, target ] = getOpData(path);
        if (target && lastKey in target) {
          changes.push({ op: 'add', path, value: object[path] });
        } else {
          changes.push({ op: 'remove', path });
        }
      }
    }
  });
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

type Timestamps = Record<string, number>;

interface LWW {
  get(property: string): number;
  set(property: string, timestamp: number): Timestamps;
  toJSON(): Timestamps;
}
