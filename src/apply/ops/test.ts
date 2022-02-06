import { deepEqual } from '../utils/deepEqual';
import { getOpData } from '../utils/getOpData';

export function test(path: string, expected: any) {
  // eslint-disable-next-line no-unused-vars
  const [ keys, lastKey, target ] = getOpData(path);

  if (target === null) {
    return `[op:test] path not found: ${path}`;
  }

  if (!deepEqual(target[lastKey], expected)) {
    const a = JSON.stringify(target[lastKey]);
    const b = JSON.stringify(expected);

    return `[op:test] not matched: ${a} ${b}`;
  }
}
