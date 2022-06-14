import { JSONPatch } from './jsonPatch';
import { syncable, SyncableClient } from './syncable';


test();


async function test() {
  const options = { blacklist: new Set([ '/foos' ])};

  const client1 = syncable({}, undefined, options);
  const client2 = syncable({}, undefined, options);
  const server = syncable({}, undefined, { ...options, server: true });
  const clients = [ client1, client2 ];

  // Control when changes are sent to test client-server interaction.
  const sendChanges = async (client: SyncableClient) => {
    await client.send(async changes => {
      await Promise.resolve();
      server.receive(changes);
    });
  };

  server.onPatch((patch, rev) => {
    // console.log(rev, patch);
    clients.forEach(client => client.receive(patch, rev));
  });

  client1.change(new JSONPatch().add('/thing', {}).add('/thing/stuff', 'green jello').toJSON());
  await sendChanges(client1);
  client2.set(client1.get(), client1.getMeta());


  client1.change(new JSONPatch().add('/test', 'out').increment('/foo', 2).add('/thing', {foobar: true}).toJSON());
  client2.change(new JSONPatch().increment('/foo', 5).add('/thing/asdf', 'qwer').toJSON());

  await Promise.all([
    sendChanges(client1),
    sendChanges(client2),
  ]);

  client2.change(new JSONPatch().remove('/thing/asdf').increment('/foo').toJSON());
  await sendChanges(client2);

  console.log(server.changesSince(2));

  process.stdout.write([
    JSON.stringify([ server.get(), server.getMeta() ], null, 2),
    JSON.stringify([ client1.get(), client1.getMeta() ], null, 2),
    JSON.stringify([ client2.get(), client2.getMeta() ], null, 2),
  ].join('\n') + '\n');
}
