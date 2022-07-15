import type { JSONPatchOp, JSONPatchOpHandler } from '../types';
import { getPrefixAndProp, getPropAfter, isArrayPath, isEmptyObject, log, mapAndFilterOps, updateArrayIndexes, updateEmptyObjects, updateRemovedOps } from '../utils';
import { deepEqual } from '../utils/deepEqual';
import { getOpData } from '../utils/getOpData';
import { pluckWithShallowCopy } from '../utils/pluck';
import { toArrayIndex } from '../utils/toArrayIndex';


export const add: JSONPatchOpHandler = {
  like: 'add',

  apply(path, value) {
    if (typeof value === 'undefined') {
      return '[op:add] require value, but got undefined';
    }
    const [ keys, lastKey, target ] = getOpData(path);

    if (target === null) {
      return `[op:add] path not found: ${path}`;
    }

    if (Array.isArray(target)) {
      const index = toArrayIndex(target, lastKey);
      if (target.length < index) {
        return `[op:add] invalid array index: ${path}`;
      }
      pluckWithShallowCopy(keys).splice(index, 0, value);
    } else {
      if (!deepEqual(target[lastKey], value)) {
        pluckWithShallowCopy(keys)[lastKey] = value;
      }
    }
  },

  invert({ path }, value, changedObj, isIndex) {
    if (path.endsWith('/-')) return { op: 'remove', path: path.replace('-', changedObj.length) };
    else if (isIndex) return { op: 'remove', path };
    return (value === undefined ? { op: 'remove', path } : { op: 'replace', path, value });
  },

  transform(thisOp, otherOps, thisFirst) {
    log('Transforming', otherOps, 'against "add"', thisOp);

    if (isArrayPath(thisOp.path)) {
      // Adjust any operations on the same array by 1 to account for this new entry
      return bumpIndexes(thisOp.path, otherOps, thisFirst);
    } else if (isEmptyObject(thisOp.value)) {
      // Treat empty objects special. If two empty objects are added to the same location, don't overwrite the existing
      // one, allowing for the merging of maps together which did not exist before
      return updateEmptyObjects(thisOp.path, otherOps);
    } else {
      switch (otherOps[0].op) {
        case 'add':
          // If thisFirst is false, we should drop the "add" op because this one came first? Or
          // drop it if thisFirst === false, keep it if thisFirst === true
          break;
        case 'remove':
          //
          break;
      }


      // Remove anything that was done at this path since it is being overwritten by the add
      return updateRemovedOps(thisOp.path, otherOps, thisFirst);
    }
  }

};


function bumpIndexes(overPath: string, ops: JSONPatchOp[], thisFirst: boolean) {
  const [ arrayPrefix, indexStr ] = getPrefixAndProp(overPath);
  const overIndex = parseInt(indexStr);

  return mapAndFilterOps(ops, op => {
    const orig = op;

    if (op.path.startsWith(arrayPrefix)) {
      const prop = getPropAfter(op.path, arrayPrefix.length);
      const end = arrayPrefix.length + prop.length;
      const isAtEnd = end === op.path.length;
      const thisIndex = parseInt(prop);
      if (thisIndex < overIndex) return op;
      if (thisIndex === overIndex && isAtEnd) {
        if (op.op === 'add' || op.op === 'copy') {
          // if both adds are done at the same array index, the second one to arrive will end up second
          if (!thisFirst) return op;
        }
      }
      const newPath = arrayPrefix + (thisIndex + 1) + op.path.slice(end);
      op = { ...op, path: newPath };
      op.path = newPath;
    }

    if (op.from && op.from.startsWith(arrayPrefix)) {
      const prop = getPropAfter(op.from, arrayPrefix.length);
      const end = arrayPrefix.length + prop.length;
      const thisIndex = parseInt(prop);
      const newPath = arrayPrefix + (thisIndex + 1) + op.from.slice(end);
      if (op === orig) op = { ...op };
      op.from = newPath;
    }

    return op;
  });
}
