type TimestampsList = Record<string, number>;

interface Timestamps {
  get(property: string): number;
  set(property: string, timestamp: number): TimestampsList;
  toJSON(): TimestampsList;
}

export function getTimestamps(initialValue?: TimestampsList): Timestamps {
  const timestamps: TimestampsList = { ...initialValue };

  function get(path: string): number {
    if (path[0] !== '/') throw new TypeError('paths must start with /');
    while (path) {
      if (path in timestamps) return timestamps[path] as number;
      path = path.slice(0, path.lastIndexOf('/'));
    }
    return timestamps[path] || 0;
  }

  function set(path: string, timestamp: number): TimestampsList {
    if (path[0] !== '/') throw new TypeError('paths must start with /');
    const exceptions: TimestampsList = {};
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
