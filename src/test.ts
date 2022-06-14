import { increment } from './custom-types/increment';
import { JSONPatch } from './jsonPatch';
import { lwwClient, LWWClient, lwwServer } from './lww';


test();


async function test() {
  const options = { types: { '@inc': increment }, blacklist: new Set([ '/foos' ])};

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
    console.log(rev, patch);
    clients.forEach(client => client.receiveChange(patch, rev));
  });

  client1.makeChange(new JSONPatch().add('/thing', {}).add('/thing/stuff', 'green jello').toJSON());
  await sendChanges(client1);
  client2.set(client1.get(), client1.getMeta());


  client1.makeChange(new JSONPatch().add('/test', 'out').increment('/foo', 2).add('/thing', {foobar: true}).toJSON());
  client2.makeChange(new JSONPatch().increment('/foo', 5).add('/thing/asdf', 'qwer').toJSON());

  await Promise.all([
    sendChanges(client1),
    sendChanges(client2),
  ]);

  client2.makeChange(new JSONPatch().remove('/thing/asdf').increment('/foo').toJSON());
  await sendChanges(client2);

  process.stdout.write([
    JSON.stringify([ server.get(), server.getMeta() ], null, 2),
    JSON.stringify([ client1.get(), client1.getMeta() ], null, 2),
    JSON.stringify([ client2.get(), client2.getMeta() ], null, 2),
  ].join('\n') + '\n');
}
