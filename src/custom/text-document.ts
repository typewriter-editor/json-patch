import type { Op } from '@typewriter/document';
import type { JSONPatchOpHandler } from '../types';
import { Delta, TextDocument } from '@typewriter/document';
import { log, updateReplacedOps, get } from '../utils';
import { replace } from '../ops';

export const changeText: JSONPatchOpHandler = {
  apply(path, value) {
    const delta = Array.isArray(value) ? new Delta(value) : value as Delta;
    if (!delta || !Array.isArray(delta.ops)) {
      throw new Error('Invalid delta');
    }

    let existingData: Op[] | TextDocument | Delta | {ops: Op[]} | undefined = get(path);

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

    return replace.apply(path, doc);
  },

  transform(other, ops, priority) {
    log('Transforming ', ops,' against "@changeText"', other);

    return updateReplacedOps(other.path, ops, priority, op => {
      if (op.path !== other.path) return null; // If a subpath, it is overwritten
      if (!op.value || !Array.isArray(op.value)) return null; // If not a delta, it is overwritten
      const otherDelta = new Delta(other.value);
      let opDelta = new Delta(op.value);
      opDelta = otherDelta.transform(opDelta, !priority);
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
