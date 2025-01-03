import { beforeEach, describe, expect, it } from 'vitest';
import { JSONPatch } from '../src/jsonPatch.js';
import { SyncableClient, SyncableServer, syncable } from '../src/syncable.js';
import { JSONPatchOp } from '../src/types.js';

describe('syncable', () => {
  let client: SyncableClient;
  let server: SyncableServer;

  beforeEach(() => {
    client = syncable({}, undefined);
    server = syncable({}, undefined, { server: true });
  });

  describe('client', () => {
    it('returns its data', () => {
      expect(client.get()).toEqual({});
      client = syncable({ foo: 'bar' });
      expect(client.get()).toEqual({ foo: 'bar' });
    });

    it('allows changes through patching', () => {
      const patch = new JSONPatch().add('/foo', 'bar');
      client.change(patch);
      expect(client.get()).toEqual({ foo: 'bar' });
    });

    it('collates all changes for sending', async () => {
      client.change(new JSONPatch().add('/foo', 'bar'));
      client.change(new JSONPatch().add('/test', {}));
      client.change(new JSONPatch().add('/test/this', 'that'));
      let sentChanges: JSONPatchOp[] = [];
      await client.send(async changes => (sentChanges = changes) && [[], '1']);
      expect(sentChanges).toEqual([
        { op: 'replace', path: '/foo', value: 'bar' },
        { op: 'replace', path: '/test', value: { this: 'that' } },
      ]);
    });

    it('returns the revision', () => {
      expect(client.getRev()).toEqual('');
    });

    it('receives changes', () => {
      client.receive(new JSONPatch().replace('/x', 'foo'), '2');
      expect(client.get()).toEqual({ x: 'foo' });
      expect(client.getRev()).toEqual('2');
    });

    it('ignores older changes', () => {
      client.receive(new JSONPatch().replace('/x', 'foo'), '2');
      client.receive(new JSONPatch().replace('/x', 'foobar'), '1');
      expect(client.get()).toEqual({ x: 'foo' });
    });

    it('allows empty objects to be auto-created', () => {
      client.set({ x: { foo: 'bar' } }, { rev: '1' });
      client.receive(new JSONPatch().replace('/x/y/z', { baz: true }), '2');
      expect(client.get()).toEqual({ x: { foo: 'bar', y: { z: { baz: true } } } });
    });

    it('returns the meta', () => {
      client.receive(new JSONPatch().replace('/x', 'foo'), '2');
      client.change(new JSONPatch().add('/foo', 'bar'));
      client.change(new JSONPatch().add('/test', {}));
      expect(client.getMeta()).toEqual({ rev: '2', changed: { '/foo': null, '/test': null } });
    });

    it('stores the increment data', () => {
      client.change(new JSONPatch().add('/foo', 2));
      client.change(new JSONPatch().increment('/test', 3));
      client.change(new JSONPatch().decrement('/test', 1));
      client.change(new JSONPatch().decrement('/another', 5));
      expect(client.getMeta()).toEqual({
        rev: '',
        changed: { '/foo': null, '/test': { '@inc': 2 }, '/another': { '@inc': -5 } },
      });
    });

    it('adjusts incremented data correctly with incoming changes', () => {
      client.change(new JSONPatch().increment('/test', 3));
      client.receive(new JSONPatch().add('/test', 5), '1');
      expect(client.getMeta()).toEqual({ rev: '1', changed: { '/test': { '@inc': 3 } } });
      expect(client.get()).toEqual({ test: 8 });
      client.receive(new JSONPatch().increment('/test', 2), '2');
      expect(client.getMeta()).toEqual({ rev: '2', changed: { '/test': { '@inc': 3 } } });
      expect(client.get()).toEqual({ test: 10 });
    });

    it('adjusts bitmask data correctly with incoming changes', () => {
      client.change(new JSONPatch().bit('/test', 1, true));
      client.receive(new JSONPatch().add('/test', 5), '1');
      expect(client.getMeta()).toEqual({ rev: '1', changed: { '/test': { '@bit': 2 } } });
      expect(client.get()).toEqual({ test: 7 });
      client.receive(new JSONPatch().bit('/test', 3, true), '2');
      expect(client.getMeta()).toEqual({ rev: '2', changed: { '/test': { '@bit': 2 } } });
      expect(client.get()).toEqual({ test: 15 });
      client.change(new JSONPatch().bit('/test', 4, true));
      expect(client.getMeta()).toEqual({ rev: '2', changed: { '/test': { '@bit': 18 } } });
      expect(client.get()).toEqual({ test: 31 });
    });

    it('alerts when changes occur', () => {
      let alertedData: any = null;
      client.subscribe(data => {
        alertedData = data;
      });
      expect(alertedData).toEqual({});
      client.change(new JSONPatch().replace('/x', 'hi'));
      expect(alertedData).toEqual({ x: 'hi' });
      client.receive(new JSONPatch().replace('/x', 'bye'), '5');
      expect(alertedData).toEqual({ x: 'bye' });
    });

    it('reverts portions of a change when the server rejects it', async () => {
      let alertedData: any = null;
      client.subscribe(data => {
        alertedData = data;
      });
      expect(alertedData).toEqual({});
      client.change(new JSONPatch().replace('/x', 'hi'));
      expect(alertedData).toEqual({ x: 'hi' });
      await client.send(async () => {});
      client.receive([{ op: 'replace', path: '/x', value: 'bye' }], '1');
      expect(alertedData).toEqual({ x: 'bye' });
    });

    it('fixes incorrect number fields', async () => {
      client.change(new JSONPatch().replace('/x', 5));
      await client.send(async () => {});
      client.receive([], '1');
      expect(client.getRev()).toEqual('1');
      expect(client.get()).toEqual({ x: 5 });
      client.change(new JSONPatch().increment('/x', 3));
      await client.send(async () => {});
      client.receive([{ op: 'replace', path: '/x', value: 20 }], '2');
      expect(client.getRev()).toEqual('2');
      expect(client.get()).toEqual({ x: 20 });
    });
  });

  describe('server', () => {
    it('alerts when a patch is ready to send', async () => {
      let alertedData: any = null;
      let alertedRev: string = '0';
      server.onPatch((data, rev) => {
        alertedData = data;
        alertedRev = rev;
      });
      server.change(new JSONPatch().replace('/x', 'hi'));
      await server.getPendingPatch();
      expect(alertedData).toEqual([{ op: 'replace', path: '/x', value: 'hi' }]);
      expect(alertedRev).toEqual('0');

      server.change(new JSONPatch().replace('/y', 'bye'));
      const { patch, rev } = await server.getPendingPatch();
      expect(patch).toEqual([{ op: 'replace', path: '/y', value: 'bye' }]);
      expect(rev).toEqual('1');
      expect(patch).toEqual(alertedData);
      expect(rev).toEqual(alertedRev);
    });

    it('sends full values, not increments', async () => {
      server.receive(new JSONPatch().add('/x', 1));
      const { patch, rev } = await server.getPendingPatch();
      expect(patch).toEqual([{ op: 'add', path: '/x', value: 1 }]);
      expect(rev).toEqual('0');

      server.receive(new JSONPatch().increment('/x', 1));
      const { patch: patch2 } = await server.getPendingPatch();
      expect(patch2).toEqual([{ op: 'replace', path: '/x', value: 2 }]);

      server.change(new JSONPatch().increment('/x', 2));
      const { patch: patch3, rev: rev3 } = await server.getPendingPatch();
      expect(patch3).toEqual([{ op: 'replace', path: '/x', value: 4 }]);
      expect(rev3).toEqual('2');
    });

    it('sends back patch for version', async () => {
      server.receive(new JSONPatch().add('/x', 'hi'));
      server.receive(new JSONPatch().add('/y', 1));
      server.receive(new JSONPatch().add('/z', 'test'));
      server.receive(new JSONPatch().remove('/y'));

      const [patch, rev] = server.changesSince('0');
      expect(rev).toEqual('3');
      expect(patch).toEqual([
        { op: 'remove', path: '/y' },
        { op: 'replace', path: '/z', value: 'test' },
      ]);
    });

    it('doesn’t make a change if the new values are equal', async () => {
      server.receive(new JSONPatch().add('/x', 'hi'));
      expect(server.getRev()).toEqual('0');
      let sent = false;
      server.onPatch(() => {
        sent = true;
      });
      server.receive(new JSONPatch().replace('/x', 'hi'));
      server.change(new JSONPatch().replace('/x', 'hi'));
      expect(server.getRev()).toEqual('0');
      expect(sent).toEqual(false);
    });
  });

  describe('white/black lists', () => {
    it('filters nothing with no white or black lists', async () => {
      server.receive(new JSONPatch().add('/x', 'y'));
      expect(server.get()).toEqual({ x: 'y' });
    });

    it('filters out blacklisted changes', async () => {
      server = syncable({}, undefined, { server: true, blacklist: new Set(['/x']) });
      server.receive(new JSONPatch().add('/x', 'y'));
      expect(server.get()).toEqual({});
    });

    it('filters out non-whitelisted changes', async () => {
      server = syncable({}, undefined, { server: true, whitelist: new Set(['/x']) });
      server.receive(new JSONPatch().add('/x', 'y').add('/foo', 'bar'));
      expect(server.get()).toEqual({ x: 'y' });
    });

    it('lists support wildcards', async () => {
      server = syncable({ x: { y: { title: 'y' }, z: { title: 'z' } } }, undefined, {
        server: true,
        whitelist: new Set(['/x/*/title']),
      });
      server.receive(new JSONPatch().add('/x', 'y'));
      expect(server.get()).toEqual({ x: { y: { title: 'y' }, z: { title: 'z' } } });
      server.receive(new JSONPatch().add('/x/y/title', 'Y'));
      expect(server.get()).toEqual({ x: { y: { title: 'Y' }, z: { title: 'z' } } });
    });

    it('lists support wildcards', async () => {
      server = syncable({}, undefined, { server: true, whitelist: new Set(['/*']) });
      server.receive(new JSONPatch().add('/x', 'y'));
      expect(server.get()).toEqual({ x: 'y' });
    });
  });

  describe('rev padding', () => {
    it('pads starting revs', async () => {
      server = syncable({}, undefined, { server: true, revPad: 4 });
      expect(server.getRev()).toEqual('0000');
    });

    it('pads new revs', async () => {
      server = syncable({}, { rev: '12' }, { server: true, revPad: 4 });
      expect(server.getRev()).toEqual('12');

      server.change(new JSONPatch().add('/x', 'y'));
      expect(server.getRev()).toEqual('0013');
    });
  });
});
