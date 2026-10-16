import assert from 'tjs:assert';
import certPem from './fixtures/server-cert.pem' with { type: 'text' };
import keyPem from './fixtures/server-key.pem' with { type: 'text' };
import { createCoalescingProxy } from './helpers/tls-coalescing-proxy.js';

// The client's Finished and its first application record reach the TLS server
// in a single TCP read, immediately followed by a FIN. The server must read
// the data first and only then see EOF.

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const server = await tjs.listen('tls', '127.0.0.1', 0, { cert: certPem, key: keyPem });
const { readable: acceptStream, localPort } = await server.opened;
const proxy = await createCoalescingProxy(localPort, { endAfterFlush: true });

const client = await tjs.connect('tls', '127.0.0.1', proxy.port, { verifyPeer: false });
const { writable: cw } = await client.opened;
const writer = cw.getWriter();

await writer.write(encoder.encode('hello'));

const acceptReader = acceptStream.getReader();
const { value: conn } = await acceptReader.read();

acceptReader.releaseLock();

const { readable: sr } = await conn.opened;
const reader = sr.getReader();

let received = '';

for (;;) {
    const { value, done } = await reader.read();

    if (done) {
        break;
    }

    received += decoder.decode(value, { stream: true });
}

assert.eq(received, 'hello', 'server received the data before EOF');

writer.releaseLock();
client.close();
conn.close();
proxy.close();
server.close();
