import assert from 'tjs:assert';
import certPem from './fixtures/server-cert.pem' with { type: 'text' };
import keyPem from './fixtures/server-key.pem' with { type: 'text' };
import { createCoalescingProxy } from './helpers/tls-coalescing-proxy.js';

// The client's Finished and its first application record reach the TLS server
// in a single TCP read. The handshake only consumes the Finished; the record
// left over must still be delivered once the server starts reading.

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const server = await tjs.listen('tls', '127.0.0.1', 0, { cert: certPem, key: keyPem });
const { readable: acceptStream, localPort } = await server.opened;
const proxy = await createCoalescingProxy(localPort);

const client = await tjs.connect('tls', '127.0.0.1', proxy.port, { verifyPeer: false });
const { writable: cw } = await client.opened;
const writer = cw.getWriter();

await writer.write(encoder.encode('hello'));

const acceptReader = acceptStream.getReader();
const { value: conn } = await acceptReader.read();

acceptReader.releaseLock();

const { readable: sr } = await conn.opened;
const reader = sr.getReader();

let timer;
const timeout = new Promise(resolve => {
    timer = setTimeout(() => resolve({ timedOut: true }), 1000);
});
const result = await Promise.race([ reader.read(), timeout ]);

clearTimeout(timer);

assert.ok(!result.timedOut, 'server read the data before the timeout');
assert.eq(result.done, false, 'server did not get EOF');
assert.eq(decoder.decode(result.value), 'hello', 'server received the data');

reader.releaseLock();
writer.releaseLock();
client.close();
conn.close();
proxy.close();
server.close();
