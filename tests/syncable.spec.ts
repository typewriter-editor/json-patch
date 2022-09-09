import { expect } from 'chai'
import { JSONPatch } from '../src/jsonPatch'
import { syncable, SyncableClient, SyncableServer } from '../src/syncable'
import { JSONPatchOp } from '../src/types'


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
      let sentChanges: JSONPatchOp[] = []
      await client.send(async changes => (sentChanges = changes) && [[], 1])
      expect(sentChanges).to.deep.equal([{ op: 'replace', path: '/foo', value: 'bar'}, { op: 'replace', path: '/test', value: { this: 'that' }}])
    })

    it('returns the revision', () => {
      expect(client.getRev()).to.equal(0)
    })

    it('receives changes', () => {
      client.receive(new JSONPatch().replace('/x', 'foo'), 2)
      expect(client.get()).to.deep.equal({ x: 'foo' })
      expect(client.getRev()).to.equal(2)
    })

    it('ignores older changes', () => {
      client.receive(new JSONPatch().replace('/x', 'foo'), 2)
      client.receive(new JSONPatch().replace('/x', 'foobar'), 1)
      expect(client.get()).to.deep.equal({ x: 'foo' })
    })

    it('allows empty objects to be auto-created', () => {
      client.set({ x: { foo: 'bar' }}, { rev: 1 })
      client.receive(new JSONPatch().replace('/x/y/z', { baz: true }), 2)
      expect(client.get()).to.deep.equal({ x: { foo: 'bar', y: { z: { baz: true }}}})
    })

    it('returns the meta', () => {
      client.receive(new JSONPatch().replace('/x', 'foo'), 2)
      client.change(new JSONPatch().add('/foo', 'bar'))
      client.change(new JSONPatch().add('/test', {}))
      expect(client.getMeta()).to.deep.equal({ rev: 2, changed: { '/foo': 0, '/test': 0 }})
    })

    it('stores the increment data', () => {
      client.change(new JSONPatch().add('/foo', 2))
      client.change(new JSONPatch().increment('/test', 3))
      client.change(new JSONPatch().decrement('/test', 1))
      client.change(new JSONPatch().decrement('/another', 5))
      expect(client.getMeta()).to.deep.equal({ rev: 0, changed: { '/foo': 0, '/test': 2, '/another': -5 }})
    })

    it('adjusts incremented data correctly with incoming changes', () => {
      client.change(new JSONPatch().increment('/test', 3))
      client.receive(new JSONPatch().add('/test', 5), 1)
      expect(client.getMeta()).to.deep.equal({ rev: 1, changed: { '/test': 3 }})
      expect(client.get()).to.deep.equal({ test: 8 })
      client.receive(new JSONPatch().increment('/test', 2), 2)
      expect(client.getMeta()).to.deep.equal({ rev: 2, changed: { '/test': 3 }})
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
      client.receive(new JSONPatch().replace('/x', 'bye'), 5)
      expect(alertedData).to.deep.equal({ x: 'bye' })
    })

    it('reverts portions of a change when the server rejects it', async () => {
      let alertedData: any = null
      client.subscribe(data => {
        alertedData = data
      })
      expect(alertedData).to.deep.equal({})
      client.change(new JSONPatch().replace('/x', 'hi'))
      expect(alertedData).to.deep.equal({ x: 'hi' })
      await client.send(async () => {})
      client.receive([{ op: 'replace', path: '/x', value: 'bye' }], 1)
      expect(alertedData).to.deep.equal({ x: 'bye' })
    })

    it('fixes incorrect number fields', async () => {
      client.change(new JSONPatch().replace('/x', 5))
      await client.send(async () => {})
      client.receive([], 1)
      expect(client.getRev()).to.equal(1)
      expect(client.get()).to.deep.equal({ x: 5 })
      client.change(new JSONPatch().increment('/x', 3))
      await client.send(async () => {})
      client.receive([{ op: 'replace', path: '/x', value: 20 }], 2)
      expect(client.getRev()).to.equal(2)
      expect(client.get()).to.deep.equal({ x: 20 })
    })
  })


  describe('server', () => {

    it('alerts when a patch is ready to send', async () => {
      let alertedData: any = null
      let alertedRev: number = 0
      server.onPatch((data, rev) => {
        alertedData = data
        alertedRev = rev
      })
      server.change(new JSONPatch().replace('/x', 'hi'))
      await server.getPendingPatch()
      expect(alertedData).to.deep.equal([{ op: 'replace', path: '/x', value: 'hi' }])
      expect(alertedRev).to.equal(1)

      server.change(new JSONPatch().replace('/y', 'bye'))
      const { patch, rev } = await server.getPendingPatch()
      expect(patch).to.deep.equal([{ op: 'replace', path: '/y', value: 'bye' }])
      expect(rev).to.equal(2)
      expect(patch).to.deep.equal(alertedData)
      expect(rev).to.equal(alertedRev)
    })

    it('sends full values, not increments', async () => {
      server.receive(new JSONPatch().add('/x', 1))
      const { patch } = await server.getPendingPatch()
      expect(patch).to.deep.equal([{ op: 'add', path: '/x', value: 1 }])

      server.receive(new JSONPatch().increment('/x', 1))
      const { patch: patch2 } = await server.getPendingPatch()
      expect(patch2).to.deep.equal([{ op: 'replace', path: '/x', value: 2 }])

      server.change(new JSONPatch().increment('/x', 2))
      const { patch: patch3, rev } = await server.getPendingPatch()
      expect(patch3).to.deep.equal([{ op: 'replace', path: '/x', value: 4 }])
      expect(rev).to.equal(3)
    })

  })
})
