import { JSONPatch } from './jsonPatch';
import { lwwClient, LWWClient, lwwServer } from './lww';


test();


async function test() {
  const options = { blacklist: new Set([ '/foo' ])};

  const client1 = lwwClient({}, undefined, options);
  const client2 = lwwClient({}, undefined, options);
  const server = lwwServer({}, undefined, options);
  const clients = [ client1, client2 ];

  const sendChanges = async (client: LWWClient) => {
    await client.sendChanges(async changes => {
      await Promise.resolve();
      server.receiveChange(changes);
    });
  };

  server.onPatch((patch, rev) => {
    clients.forEach(client => client.receiveChange(patch, rev));
  });

  client1.makeChange(new JSONPatch().add('/thing', {}).add('/thing/stuff', 'green jello').toJSON());
  await sendChanges(client1);
  // client2.set(client1.get(), client1.getMeta());


  client1.makeChange(new JSONPatch().add('/test', 'out').add('/foo', 'bar').add('/thing', {foobar: true}).toJSON());
  client2.makeChange(new JSONPatch().add('/foo', '######').add('/thing/asdf', 'qwer').toJSON());

  await Promise.all([
    sendChanges(client1),
    sendChanges(client2),
  ]);

  process.stdout.write([
    JSON.stringify([ server.get(), server.getMeta() ], null, 2),
    JSON.stringify([ client1.get(), client1.getMeta() ], null, 2),
    JSON.stringify([ client2.get(), client2.getMeta() ], null, 2),
  ].join('\n') + '\n');
}
