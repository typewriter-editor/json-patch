import { applyPatch, lwwDiffs, JSONPatch } from '.';


let client = {};
let server = {};

const old = Date.now() - 1000;

client = applyPatch(client, new JSONPatch().ts(old).add('/thing', {}).add('/thing/stuff', 'green jello').toJSON());
server = applyPatch(server, new JSONPatch().ts(old).add('/thing', {}).add('/thing/stuff', 'green jello').toJSON());


client = applyPatch(client, new JSONPatch().ts(Date.now()).add('/test', 'out').add('/foo', 'bar').add('/thing', {foobar: true}).toJSON());
server = applyPatch(server, new JSONPatch().ts(Date.now() + 1).add('/foo', 'bars').add('/thing/asdf', 'qwer').toJSON());

const [ clientPatch, serverPatch ] = lwwDiffs(client, server);

console.log('diffs', [ serverPatch, clientPatch ]);
console.log([ applyPatch(server, serverPatch), applyPatch(client, clientPatch) ]);
