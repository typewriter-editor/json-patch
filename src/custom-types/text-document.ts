import type { Op } from '@typewriter/document';
import type { JSONPatchCustomType } from '../types';
import { Delta, TextDocument } from '@typewriter/document';
import { applyOps, log, updateRemovedOps } from '..';

export const changeText: JSONPatchCustomType = {
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

    let existingData: Op[] | TextDocument | Delta | {ops: Op[]} | undefined = applyOps.get(path);

    let doc: TextDocument | undefined;
    if (existingData && (existingData as TextDocument).lines) {
      doc = existingData as TextDocument;
    } else if (Array.isArray(existingData)) {
      if (existingData.length && existingData[0].insert) {
        doc = new TextDocument(new Delta(existingData));
      }
    } else if (existingData && (existingData as Delta).ops) {
      doc = new TextDocument(new Delta((existingData as Delta).ops));
    }

    if (!doc) {
      doc = new TextDocument();
    }

    doc = doc.apply(delta, undefined, true);

    if (hasInvalidOps(doc)) {
      throw new Error('Invalid text delta provided for this text document');
    }

    return applyOps.replace(path, doc);
  },

  rebase(over, ops) {
    log('Transforming ', ops,' against "@changeText"', over);

    return updateRemovedOps(over.path, ops, op => {
      if (op.path !== over.path) return null; // If a subpath, it is overwritten
      if (!op.value || !Array.isArray(op.value)) return null; // If not a delta, it is overwritten
      const overDelta = new Delta(over.value);
      let opDelta = new Delta(op.value);
      opDelta = overDelta.transform(opDelta, true);
      return { ...op, value: opDelta.ops };
    });
  },

  invert({ path, value }, oldValue: TextDocument, changedObj) {
    if (path.endsWith('/-')) path = path.replace('-', changedObj.length);
    const delta = new Delta(value);
    return oldValue === undefined
      ? { op: 'remove', path }
      : { op: '@changeText', path, value: delta.invert(oldValue.toDelta()) };
  },

  compose(op1, op2) {
    return new Delta(op1.value).compose(new Delta(op2.value));
  }
};

function hasInvalidOps(doc: TextDocument) {
  return doc.lines.some(line => line.content.ops.some(op => !op.insert));
}
