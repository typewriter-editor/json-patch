import type { Op } from '@typewriter/delta';
import type { JSONPatchCustomType } from '../types';
import { Delta } from '@typewriter/delta';
import { applyOps, log, updateRemovedOps } from '..';

export const text: JSONPatchCustomType = {
  apply(path, value) {
    const ops = (value as Op[])
      .filter(op => op.insert !== '')
      .map(op => {
        if (op.attributes?.id) {
          const { id, ...attributes } = op.attributes;
          return { ...op, attributes };
        } else {
          return op;
        }
      });
    const delta = new Delta(ops);

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
      doc = new Delta();
    }

    doc = doc.compose(delta);

    if (hasInvalidOps(doc)) {
      throw new Error('Invalid text delta provided for this text document');
    }

    return applyOps.replace(path, doc);
  },

  rebase(over, ops) {
    log('Transforming ', ops,' against "@text"', over);

    return updateRemovedOps(over.path, ops, op => {
      if (op.path !== over.path) return null; // If a subpath, it is overwritten
      if (!op.value || !Array.isArray(op.value)) return null; // If not a delta, it is overwritten
      const overDelta = new Delta(over.value);
      let opDelta = new Delta(op.value);
      opDelta = overDelta.transform(opDelta, true);
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
