import { getOpData } from '../utils/getOpData';
import { add } from './add';
export function copy(path, value, from) {
    // eslint-disable-next-line no-unused-vars
    const [keys, lastKey, target] = getOpData(from);
    if (target === null) {
        return `[op:copy] path not found: ${from}`;
    }
    return add(path, target[lastKey]);
}
