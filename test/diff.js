'use strict';
import 'run-with-mocha';
import assert from 'assert';
import specTests from 'json-patch-test-suite/spec_tests';
import tests from 'json-patch-test-suite/tests';
import fastPatch from 'fast-json-patch';
import { applyPatch } from '..';

const diff = fastPatch.compare;

describe('spec tests', () => {
  specTests.filter((test) => {
    return !test.disabled && !test.error && test.expected;
  }).forEach(({ comment, doc, expected }) => {
    it(`${ comment || JSON.stringify(doc) }`, () => {
      const originalDoc = JSON.parse(JSON.stringify(doc));
      const actual = applyPatch(doc, diff(doc, expected));

      assert.deepEqual(actual, expected);
      assert.deepEqual(doc, originalDoc);
    });
  });
});

describe('tests', () => {
  tests.filter((test) => {
    return !test.disabled && !test.error && test.expected;
  }).forEach(({ comment, doc, expected }) => {
    it(`${ comment || JSON.stringify(doc) }`, () => {
      const originalDoc = JSON.parse(JSON.stringify(doc));
      const actual = applyPatch(doc, diff(doc, expected));

      assert.deepEqual(actual, expected);
      assert.deepEqual(doc, originalDoc);
    });
  });
});
