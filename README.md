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

## Syncing Objects

This library provides a utility that will help sync an object field-by-field using the Last-Write-Wins (LWW) algorithm.
This sync method is not as robust as operational transformation, but it only stores a little data in addition to the
object and is much simpler. It does not handle adding/removing array items, though entire arrays can
be set. It should work great for documents like Figma describes in
https://www.figma.com/blog/how-figmas-multiplayer-technology-works/ and for objects like user preferences.

It works by using metadata to track the current revision of the object, any outstanding changes needing to be sent to
the server from the client, and the revisions of each added value on the server so that one may get all changes since
the last revision it was synced. The metadata will be very small on the client, and smallish on the server. It is up to
you to store this metadata with the rest of the object. These are tools to help you deal with the harder part of LWW
syncing, but you'll have to implement it in your system.

It should work with clients offline, though those clients will "win" when they come back online and write their changes
to the server. If this is not desired, simply send the data from the server down when first connecting and then just
receive changes.

It includes a whitelist and blacklist of properties that cannot be set by the client, only set by the server.

On the client:
```js
import { applyPatch, syncableObject } from '@typewriter/json-patch';

// Create a new LWW object
const newObject = syncableObject({ baz: 'qux', foo: 'bar' });

// Send the initial object to the server
newObject.send(async patch => {
  // A function you define using fetch, websockets, etc
  await sendJSONPatchChangesToServer(patch);
});

// Or load a syncable object from storage (or from the server)
const { data, metadata } = JSON.parse(localStorage.getItem('my-object-key'));
const object = syncableObject(data, metadata);

// Automatically send changes when changes happen.
// This will be called immediately if there are outstanding changes needing to be sent.
object.subscribe((data, meta, hasUnsentChanges) => {
  if (hasUnsentChanges) {
    object.send(async patch => {
      // A function you define using fetch, websockets, etc. Be sure to use await/promises to know when it is complete
      // or errored. Place the try/catch around send, not inside
      await sendJSONPatchChangesToServer(patch);
    });
  }
});

// Get changes since last synced after sending any outstanding changes
const response = await getJSONPatchChangesFromServer(object.getRev());
if (response.patch && response.rev) {
  object.receive(response.patch, response.rev);
}

// When receiving a change from the server, call receive
// (`onReceiveChanges` is a method created by you, could use websockets or polling, etc)
onReceiveChanges((patch, rev) => {
  object.receive(patch, rev);
});

// persist to storage for offline use if desired. Will persist unsynced changes made offline.
object.subscribe((data, metadata) => {
  localStorage.setItem('my-object-key', JSON.stringify({
    data, metadata,
  }));
});
```

On the server:
```js
import { applyPatch, lwwServer } from '@typewriter/json-patch';

// Create a new LWW object
const newObject = lwwServer({ baz: 'qux', foo: 'bar' });

// Or load an LWW object from storage or from the server
const { data, metadata } = db.loadObject('my-object');
const object = lwwServer(data, metadata);

// Get changes from a client
object.receiveChanges(request.body.patch);

// Automatically send changes to clients when changes happen
object.onPatch((patch, rev) => {
  clients.forEach(client => {
    client.send({ patch, rev });
  });
});

// Auto merge received changes from the client
onReceiveChanges((patch) => {
  // Notice this is different than the client. No rev is provided, allowing the server to set the next rev
  object.receiveChanges(patch);
  storeObject();
});

// persist to storage
function storeObject() {
  db.put('my-object-key', {
    data: object.get(),
    metadata: object.getMeta(),
  });
}
```

## License

MIT
