# json-patch

> Immutable JSON Patch implementation based on [RFC 6902](https://tools.ietf.org/html/rfc6902).
> Originally from https://github.com/mohayonao/json-touch-patch which is no longer supported. Refactored to TypeScript
> and added features to support syncing via Operational Transformation and Last-write-wins.

## Features

- **Immutable**: The original JSON is not update. The patches create to a new JSON.
- **Rollback**: If error occurs, all patches are rejected. Return the original JSON.
- **Customizable**: You can add custom operators.
- **Patch API**: A JSONPatch object to simplify the creation of patches.
- **Multiplayer**: You can transform patches against each other for collaborative systems using Operational Transformation.
- **Syncable**: You can sync an object’s fields using Last-write-wins at a field level

## Installation

```
$ npm install --save @typewriter/json-patch
```

## API

- `patch(prevObject: object, patches: object[], [ opts: object ]): object`
  - `opts.custom: object` custom operator definition.
  - `opts.partial: boolean` not reject patches if error occurs (partial patching)
  - `opts.strict: boolean` throw an exception if error occurs
  - `opts.error: object` point to a cause patch if error occurs
  - returns `nextObject: object`

## Quick example

```js
import { applyPatch } from '@typewriter/json-patch';

const prevObject = { baz: 'qux', foo: 'bar' };
const patches = [
  { op: 'replace', path: '/baz', value: 'boo' },
];
const nextObject = applyPatch(prevObject, patches);
// → { baz: "boo", foo: "bar" }
//              |
//             replaced

console.log(prevObject);
// → { baz: "qux", foo: "bar" }
//              |
//             not changed
```

## How to apply patches

### add

```js
const patches = [
  { op: "add", path: "/matrix/1/-", value: 9 },
];
```

Return a new JSON. It contains shallow-copied elements that have some changes into child elements. And it contains original elements that were not updated.

![add](assets/patch-add.png)

```js
assert(prevObject.matrix[0] === nextObject.matrix[0]);
assert(prevObject.matrix[1] !== nextObject.matrix[1]);
assert(prevObject.matrix[2] === nextObject.matrix[2]);
```

### remove

```js
const patches = [
  { op: "remove", path: "/matrix/1" },
];
```

Return a new JSON. It contains shallow-copied elements that have some changes into child elements. And it contains original elements that are not updated any.

![remove](assets/patch-remove.png)

```js
assert(prevObject.matrix[0] === nextObject.matrix[0]);
assert(prevObject.matrix[1] !== nextObject.martix[1]);
assert(prevObject.matrix[2] === nextObject.matrix[1]);
```

### replace

```js
const patches = [
  { op: "replace", path: "/matrix/1/1", value: 9 },
];
```

Return a new JSON. It contains shallow-copied elements that have some changes into child elements. And it contains original elements that are not updated any.

![replace](assets/patch-replace.png)

```js
assert(prevObject.matrix[0] === nextObject.matrix[0]);
assert(prevObject.matrix[1] !== nextObject.matrix[1]);
assert(prevObject.matrix[2] === nextObject.matrix[2]);
```

### replace (no changes)

```js
const patches = [
  { op: "replace", path: "/matrix/1/1", value: 4 },
];
```

Return the original JSON. Because all elements are not changed.

![replace](assets/patch-no-change.png)

`prevObject.matrix[1][1]` is already `4`. So, this patch is need not to update any.

```js
assert(prevObject === nextObject);
```

### move

```js
const patches = [
  { op: "move", from: "/matrix/1", path: "/matrix/2" },
];
```

Return a new JSON. `[op:move]` works as `[op:get(from)]` -> `[op:remove(from)]` -> `[op:add(path)]`.

![move](assets/patch-move.png)

```js
assert(prevObject.matrix[0] === nextObject.matrix[0]);
assert(prevObject.matrix[1] === nextObject.martix[2]);
assert(prevObject.matrix[2] === nextObject.matrix[1]);
```

### copy

```js
const patches = [
  { op: "copy", from: "/matrix/1", path: "/matrix/1" },
];
```

Return a new JSON. `[op:copy]` works as `[op:get(from)]` -> `[op:add(path)]`.

![copy](assets/patch-copy.png)

```js
assert(prevObject.matrix[0] === nextObject.matrix[0]);
assert(prevObject.matrix[1] === nextObject.martix[1]);
assert(prevObject.matrix[1] === nextObject.martix[2]);
assert(prevObject.matrix[2] === nextObject.matrix[3]);
```

### test failed

```js
const patch = [
  { op: "add" , path: "/matrix/1/-", value: 9 },
  { op: "test", path: "/matrix/1/1", value: 0 },
];
```

Return the original JSON. Because a test op is failed. All patches are rejected.

![test](assets/patch-no-change.png)

`prevObject.matrix[1][1]` is not `0` but `4`. So, this test is failed.

```js
assert(prevObject === nextObject);
```

### invalid patch

```js
const json = [
  { op: "replace", path: "/matrix/1/100", value: 9 },
];
```

Return the original JSON. Because all patches are rejected when error occurs.

![invalid](assets/patch-no-change.png)

`prevObject.matrix[1][100]` is not defined. So, this patch is invalid.

```js
assert(prevObject === nextObject);
```

## Syncing using Last-Write-Wins

You can use the Last-Write-Wins (LWW) strategy at the field level with JSON Patch to sync object changes between
clients. Both objects must be in memory together somewhere to get the initial patches, but after that they can send
just the updates. For example, you might download the latest object from the server when initially connecting via a
websocket, applying any changes locally and sending back patches for any local changes that need to sync. Then after
the initial download, the server can just send change patches received from other connections.

```js
import { applyPatch, lwwDiffs } from '@typewriter/json-patch';

// Retrieve a remote object somehow, e.g. through a websocket
// const remoteObject = await getObjectFromServer();
const remoteObject = { baz: 'foobar', foo: 'bar', $lww$: { '/baz': 1654756109708, '/foo': 1654756064110 } };
let localObject = { baz: 'qux', foo: 'bar', $lww$: { '/baz': 1654755627580, '/foo': 1654756064110 } };

// Compare the two and find the differences that need to be applied to each, in this case a remote change is newer
const [ localPatches, remotePatches ] = lwwDiffs(localObject, remoteObject);

console.log(localPatches)
// → [{ op: "add", path: "/baz", value: "foobar", "ts": 1654756109708 }]
console.log(remotePatches)
// → []

if (localPatches.length) {
  localObject = applyPatch(localObject, localPatches);
}
if (remotePatches) {
  await sendPatchesToServer(remotePatches); // method you define to sync the changes to the server
}
```

## Syncing using Last-Write-Wins with "rev"

Each change to an object can create a "rev" starting at 1, 2, 3, etc. Two clients each creating a rev of 4 and sending
them to the server will collide. The server will receive one first and commit it as rev 4, the second will be bumped to
rev 5 and send the changes back down to the clients. A client receiving a rev 4 from the server when it already has one
will merge the change except when it is on the same property. If it is on the same property, it will know that either
that change was the one it sent and so it is the same, or it will know that its change was bumped to 5 and expect that
change to come any moment to update the rev of the field but not the value.

By using rev instead of timestamps, the client and server can exchange much less information. The client can store the
last confirmed rev and send a single patch with all the new changes when initially starting a sync, asking for any new
updates from the server. The downside is that a preference changed weeks ago on an offline device will overwrite any
new changes to it. This can be the same with OT and is the challenge with offline systems. Though the timestamp method
from above handles this. What is the desired behavior? I feel like this one might be more desireable.

Rules:
* all changes made while offline or while sending a patch will be grouped into one rev to be sent to the server
* when changes are sent to the server, any changed properties will not be allowed to be updated until the change is
  acknowledged by the server
* the server may have a list of paths that cannot be changed by the client for a collection. It will reject any patches
  that are equal to or prefixed by those paths. A blacklist. A whitelist may be provided as well.

The state of some object
```js
$lww$ = {
  rev: 1, // the last change received from the server
}
```

A new change is made and remembered. If connected, immediately sends the update to the server.
```js
$lww$ = {
  rev: 1, // the last change received from the server
  changed: { // could be a Set
    "/foo": true
  },
  sending: {},
}
```

Sending the change to the server marks as pending, any changes from the server that target a property in sending will
be ignored, any others will be merged right away
```js
$lww$ = {
  rev: 4, // the last change received from the server, could be 2, 3, 4
  changed: {},
  sending: { // could be a Set
    "/foo": true
  },
}
```

Once done it should be in the same state as the server.
```js
$lww$ = {
  rev: 5, // the last change received from the server
  changed: {},
  sending: {},
}
```

We should send the local rev with the changes on initial sync and the server can send back all required patches.

The server will need to store the rev for each property so when asked to get changes since rev 1 it can respond with all
the necessary values.

The server data will be:
```js
$lww$ = {
  rev: 5, // the rev to keep track of where we're at
  '/baz': 1,
  '/foo': 5
}
```

If the server doesn't save the last few revs it won't be able to sync with any local data. It is the source of truth and
a local rev could be ahead of a server rev unless we stored all local data with the rev and allowed the server to sync
with a client by that rev.

So methods would be:
* [server] accept a change from remote (no rev associated with it), bumps rev and applies those changes to it
* [client] accept a change from server (rev associated with it), applies changes except if they are to sending ones
* [client+server] request changes since rev, get all changes from remote since then
* [client] make a change, stores it in the changed set, ready to be sent to the server
* [client] send changes, moves changed to sending and creates new changed, allows for new changes while sending is out

So when FIRST connecting, client sends current rev and any uncommitted changes. Server will then:
1. if the clients rev is > than server rev, **request** client for changes since server rev before committing client changes
2. if the client rev is < server rev **send** changes since client rev
3. commit client changes
4. respond to client that the changes were committed and send those changes to other or all connected clients with the rev

IF we know our server won't lose data we can skip step 1 and skip storing all property rev numbers on the client. If
we did this and the server *was* behind the client, the client will have changes the server doesn't have and others will
not until those properties are changed again.

One problem with #1 is that the client may not have the properties the server requires as they may have changed while
offline, but if they were changed offline, they'll be overwriting anything old anyway, so that actually isn't a problem.

## Syncing using Last-Write-Wins with timestamp lists

Another option is to send the $lww$ object up when syncing and getting back the list of properties to send and the patch
to update the local object. This may not be any more efficient than just pulling down the server object on sync.

## License

MIT
