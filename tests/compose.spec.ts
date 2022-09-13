import { expect } from 'chai'
import { text } from '../src/custom/delta'
import { composePatch as originalComposePatch } from '../src/composePatch'
import { JSONPatchOp } from '../src/types'

const matrix = [[],[],[],[],[],[],[]]
const arr = [{},{},{},{},{},{},{}]
const obj = {x:arr}

describe('composePatch', () => {
  const types = {
    '@changeText': text,
  }

  function composePatch(ops: JSONPatchOp[]) {
    return originalComposePatch(ops, types)
  }

  it('replace compose', () => {
    expect(composePatch([
      { op: 'replace', path: '/x', value: 4 },
      { op: 'replace', path: '/x', value: 2 },
      { op: 'replace', path: '/x', value: 8 },
    ])).to.deep.equal([{ op: 'replace', path: '/x', value: 8 }])
  })

  it('increment compose', () => {
    expect(composePatch([
      { op: '@inc', path: '/x', value: 4 },
      { op: '@inc', path: '/x', value: 2 },
      { op: '@inc', path: '/x', value: -10 },
      { op: '@inc', path: '/x', value: 20 },
    ])).to.deep.equal([{ op: '@inc', path: '/x', value: 16 }])
  })

  it('text compose', () => {
    expect(composePatch([
      { op: '@changeText', path: '/x', value: { ops: [{ insert: 'How about th' }] }},
      { op: '@changeText', path: '/x', value: { ops: [{ retain: 12 }, { insert: 'at!' }] }},
      { op: '@changeText', path: '/x', value: { ops: [{ delete: 3 }, { insert: 'Who' }, { retain: 1 }, { delete: 5 }, { insert: 'is' }] }},
    ])).to.deep.equal([{ op: '@changeText', path: '/x', value: { ops: [{ insert: 'Who is that!' }] }}])
  })

  it('only composes contiguous', () => {
    expect(composePatch([
      { op: '@inc', path: '/x/3', value: 4 },
      { op: 'add', path: '/x/1', value: 2 },
      { op: '@inc', path: '/x/3', value: 1 },
      { op: '@inc', path: '/x/3', value: 1 },
    ])).to.deep.equal([
      { op: '@inc', path: '/x/3', value: 4 },
      { op: 'add', path: '/x/1', value: 2 },
      { op: '@inc', path: '/x/3', value: 2 },
    ])
  })
})
