import { expect } from 'chai'
import { JSONPatch } from '../src/jsonPatch'
import { syncable, SyncableClient, SyncableServer } from '../src/syncable'


describe('syncable', () => {
  let client: SyncableClient
  let server: SyncableServer

  beforeEach(() => {
    client = syncable({}, undefined)
    server = syncable({}, undefined, { server: true })
  })


  describe('client', () => {

    it('returns its data', () => {
      expect(client.get()).to.deep.equal({})
      client = syncable({ foo: 'bar' })
      expect(client.get()).to.deep.equal({ foo: 'bar' })
    })

    it('allows changes through patching', () => {
      const patch = new JSONPatch().add('/foo', 'bar')
      client.change(patch)
      expect(client.get()).to.deep.equal({ foo: 'bar' })
    })

    it('collates all changes for sending', async () => {
      client.change(new JSONPatch().add('/foo', 'bar'))
      client.change(new JSONPatch().add('/test', {}))
      client.change(new JSONPatch().add('/test/this', 'that'))
      const sentChanges = await client.send(async changes => changes)
      expect(sentChanges).to.deep.equal([{ op: 'replace', path: '/foo', value: 'bar'}, { op: 'replace', path: '/test', value: { this: 'that' }}])
    })

    it('returns the revision', () => {
      expect(client.getRev()).to.equal('0')
    })

    it('receives changes', () => {
      client.receive(new JSONPatch().replace('/x', 'foo'), '2')
      expect(client.get()).to.deep.equal({ x: 'foo' })
      expect(client.getRev()).to.equal('2')
    })

    it('ignores older changes', () => {
      client.receive(new JSONPatch().replace('/x', 'foo'), '2')
      client.receive(new JSONPatch().replace('/x', 'foobar'), '1')
      expect(client.get()).to.deep.equal({ x: 'foo' })
    })

    it('returns the meta', () => {
      client.receive(new JSONPatch().replace('/x', 'foo'), '2')
      client.change(new JSONPatch().add('/foo', 'bar'))
      client.change(new JSONPatch().add('/test', {}))
      expect(client.getMeta()).to.deep.equal({ rev: '2', changed: { '/foo': 0, '/test': 0 }})
    })

    it('stores the increment data', () => {
      client.change(new JSONPatch().add('/foo', 2))
      client.change(new JSONPatch().increment('/test', 3))
      client.change(new JSONPatch().decrement('/test', 1))
      client.change(new JSONPatch().decrement('/another', 5))
      expect(client.getMeta()).to.deep.equal({ rev: '0', changed: { '/foo': 0, '/test': 2, '/another': -5 }})
    })

    it('adjusts incremented data correctly with incoming changes', () => {
      client.change(new JSONPatch().increment('/test', 3))
      client.receive(new JSONPatch().add('/test', 5), '1')
      expect(client.getMeta()).to.deep.equal({ rev: '1', changed: { '/test': 3 }})
      expect(client.get()).to.deep.equal({ test: 8 })
      client.receive(new JSONPatch().increment('/test', 2), '2')
      expect(client.getMeta()).to.deep.equal({ rev: '2', changed: { '/test': 3 }})
      expect(client.get()).to.deep.equal({ test: 10 })
    })

    it('alerts when changes occur', () => {
      let alertedData: any = null
      client.subscribe(data => {
        alertedData = data
      })
      expect(alertedData).to.deep.equal({})
      client.change(new JSONPatch().replace('/x', 'hi'))
      expect(alertedData).to.deep.equal({ x: 'hi' })
      client.receive(new JSONPatch().replace('/x', 'bye'), '5')
      expect(alertedData).to.deep.equal({ x: 'bye' })
    })
  })


  describe('server', () => {

    it('alerts when a patch is ready to send', async () => {
      let alertedData: any = null
      let alertedRev: string = '0'
      server.onPatch((data, rev) => {
        alertedData = data
        alertedRev = rev
      })
      server.change(new JSONPatch().replace('/x', 'hi'))
      await server.getPendingPatch();
      expect(alertedData).to.deep.equal([{ op: 'replace', path: '/x', value: 'hi' }])
      expect(alertedRev).to.equal('1')

      server.change(new JSONPatch().replace('/y', 'bye'))
      const { patch, rev } = await server.getPendingPatch();
      expect(patch).to.deep.equal([{ op: 'replace', path: '/y', value: 'bye' }])
      expect(rev).to.equal('2')
      expect(patch).to.deep.equal(alertedData)
      expect(rev).to.equal(alertedRev)
    })

    it('sends full values, not increments', async () => {
      server.receive(new JSONPatch().add('/x', 1))
      const { patch } = await server.getPendingPatch();
      expect(patch).to.deep.equal([{ op: 'add', path: '/x', value: 1 }])

      server.receive(new JSONPatch().increment('/x', 1))
      const { patch: patch2 } = await server.getPendingPatch();
      expect(patch2).to.deep.equal([{ op: 'replace', path: '/x', value: 2 }])

      server.change(new JSONPatch().increment('/x', 2))
      const { patch: patch3, rev } = await server.getPendingPatch();
      expect(patch3).to.deep.equal([{ op: 'replace', path: '/x', value: 4 }])
      expect(rev).to.equal('3')
    })

    it('rev increments', () => {
      server.set({}, {rev: '9'})
      server.receive(new JSONPatch().add('/x', 'y'))
      expect(server.getMeta()).to.deep.equal({ rev: 'A', paths: { '/x': 'A' }})

      server.set({}, {rev: 'Z'})
      server.receive(new JSONPatch().add('/x', 'y'))
      expect(server.getMeta()).to.deep.equal({ rev: 'a', paths: { '/x': 'a' }})

      server.set({}, {rev: 'z'})
      server.receive(new JSONPatch().add('/x', 'y'))
      expect(server.getMeta()).to.deep.equal({ rev: '00', paths: { '/x': '00' }})
      server.receive(new JSONPatch().add('/x', 'y'))
      expect(server.getMeta()).to.deep.equal({ rev: '01', paths: { '/x': '01' }})

      server.set({}, {rev: '0zzzz'})
      server.receive(new JSONPatch().add('/x', 'y'))
      expect(server.getMeta()).to.deep.equal({ rev: '10000', paths: { '/x': '10000' }})

      server.set({}, {rev: 'zzzzz'})
      server.receive(new JSONPatch().add('/x', 'y'))
      expect(server.getMeta()).to.deep.equal({ rev: '000000', paths: { '/x': '000000' }})
    })

  })
})
