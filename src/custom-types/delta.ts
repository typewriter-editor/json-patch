import type { Op } from '@typewriter/delta';
import type { JSONPatchCustomType } from '../types';
import { Delta } from '@typewriter/delta';
import { applyOps, log, updateReplacedOps } from '..';

export const text: JSONPatchCustomType = {
  apply(path, value) {
    const delta = Array.isArray(value) ? new Delta(value) : value as Delta;
    if (!delta || !Array.isArray(delta.ops)) {
      throw new Error('Invalid delta');
    }

    let existingData: Op[] | Delta | {ops: Op[]} | undefined = applyOps.get(path);

    let doc: Delta | undefined;
    if (Array.isArray(existingData)) {
      if (existingData.length && existingData[0].insert) {
        doc = new Delta(existingData);
      }
    } else if (existingData && existingData.ops) {
      doc = new Delta(existingData.ops);
    }

    if (!doc) {
      doc = new Delta().insert('\n');
    }

    doc = doc.compose(delta);

    if (hasInvalidOps(doc)) {
      throw new Error('Invalid text delta provided for this text document');
    }

    return applyOps.replace(path, doc);
  },

  transform(other, ops, priority) {
    log('Transforming ', ops,' against "@text"', other);

    return updateReplacedOps(other.path, ops, priority, op => {
      if (op.path !== other.path) return null; // If a subpath, it is overwritten
      if (!op.value || !Array.isArray(op.value)) return null; // If not a delta, it is overwritten
      const otherDelta = new Delta(other.value);
      let opDelta = new Delta(op.value);
      opDelta = otherDelta.transform(opDelta, !priority);
      return { ...op, value: opDelta.ops };
    });
  },

  invert({ path, value }, oldValue: Delta, changedObj) {
    if (path.endsWith('/-')) path = path.replace('-', changedObj.length);
    const delta = new Delta(value);
    return oldValue === undefined
      ? { op: 'remove', path }
      : { op: '@text', path, value: delta.invert(oldValue) };
  },

  compose(op1, op2) {
    return new Delta(op1.value).compose(new Delta(op2.value));
  }
};

function hasInvalidOps(doc: Delta) {
  return doc.ops.some(op => !op.insert);
}
