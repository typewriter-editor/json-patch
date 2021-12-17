import { root } from '../state';
export function exit(object, patch, opts) {
    opts.error = patch;
    return opts.partial && root ? root[''] : object;
}
