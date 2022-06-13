import { expect } from 'chai';
import { text } from '../src/custom-types/delta';
import { JSONPatch, JSONPatchOp, verbose } from '../src';
import { Delta, Op } from '@typewriter/delta';
import { increment } from '../src/custom-types/increment';

class MyJSONPatch extends JSONPatch {
  constructor(ops?: JSONPatchOp[]) {
    super(ops, { '@inc': increment, '@changeText': text });
  }

  increment(path: string, value: number) {
    return this.op('@inc', path, value);
  }

  decrement(path: string, value: number) {
    return this.op('@inc', path, -value);
  }

  changeText(path: string, value: Delta | Op[]) {
    const delta = Array.isArray(value) ? new Delta(value) : value as Delta;
    if (!delta || !Array.isArray(delta.ops)) {
      throw new Error('Invalid Delta');
    }
    return this.op('@changeText', path, value);
  }
}

describe('JSONPatch.transform', () => {
  // verbose(true);

  let delta = new Delta();
  const arr = [1, 2, 3, 4];

  function patch() {
    return new MyJSONPatch();
  }

  function testPatches(start: any, patch1: JSONPatch, patch2: JSONPatch, reverse: boolean) {
    let client1 = start, client2 = start, server = start;
    // Patches applied on clients simultaneously
    client1 = patch1.apply(client1);
    client2 = patch2.apply(client2);
    // Both patches sent to the server, client 1 reaches there first
    server = patch1.apply(server);
    // Server sees that patch2 was at the same rev # as patch1 and transforms it, sending the transformed patch to
    // to the clients.
    let patch2T = patch1.transform(patch2);
    server = patch2T.apply(server);
    // client 1 gets patch2T from the server at rev+1 and applies it directly, never knowing it was transformed
    client1 = patch2T.apply(client1);
    // client 2 gets patch1 at the same rev that its patch2 was sent and must transform it against patch2, giving
    // patch1 priority since it knows it was committed before patch2.
    let patch1T = patch2.transform(patch1, true);
    client2 = patch1T.apply(client2);
    // console.log(server);
    // console.log(client1);
    // console.log(client2);
    expect(client1).to.deep.equal(server, `base transformation did not work${reverse ? ' in reverse' : ''}`);
    expect(client2).to.deep.equal(server, `transformation with priority did not work${reverse ? ' in reverse' : ''}`);
  }

  function test(start: any, patch1: JSONPatch, patch2: JSONPatch) {
    testPatches(start, patch1, patch2, false);
    testPatches(start, patch2, patch1, true);
  }

  it('converts ops on deleted elements to noops', () => {
    test(arr, patch().remove('/1'), patch().remove('/1'));
    test(arr, patch().replace('/1', 'foo'), patch().remove('/1'));
    test(arr, patch().changeText('/1', delta), patch().remove('/1'));
    test(arr, patch().add('/1', true), patch().remove('/1'));
  })

  it('moves target index on remove/add', () => {
    test(arr, patch().move('/0', '/2'), patch().remove('/1'));
    test(arr, patch().move('/2', '/3'), patch().remove('/1'));
    // expect(transformPatch([{ op: 'move', from: '/0', path: '/2' }], [{ op: 'remove', path: '/1', value: 'x' }])).to.deep.equal([{ op: 'move', from: '/0', path: '/1' }]);
    // expect(transformPatch([{ op: 'move', from: '/2', path: '/4' }], [{ op: 'remove', path: '/1', value: 'x' }])).to.deep.equal([{ op: 'move', from: '/1', path: '/3' }]);
    // expect(transformPatch([{ op: 'move', from: '/0', path: '/2' }], [{ op: 'add', path: '/1', value: 'x' }])).to.deep.equal([{ op: 'move', from: '/0', path: '/3' }]);
    // expect(transformPatch([{ op: 'move', from: '/2', path: '/4' }], [{ op: 'add', path: '/1', value: 'x' }])).to.deep.equal([{ op: 'move', from: '/3', path: '/5' }]);
    // expect(transformPatch([{ op: 'move', from: '/0', path: '/0' }], [{ op: 'add', path: '/0', value: 28 }])).to.deep.equal([{ op: 'move', from: '/1', path: '/1' }]);
  })

})
