import assert from 'tjs:assert';
import path from 'tjs:path';
import certPem from './fixtures/server-cert.pem' with { type: 'text' };
import keyPem from './fixtures/server-key.pem' with { type: 'text' };
import { createCoalescingProxy } from './helpers/tls-coalescing-proxy.js';

// Data that arrives with the client's Finished is delivered from startRead(),
// which JS calls while the server is still building the accepted socket. That
// delivery must not run pending jobs: here a pending fs continuation closes the
// server, and if it ran in the middle of the accept path, enqueueing the
// accepted socket would throw an uncaught TypeError.

const fixture = path.join(import.meta.dirname, 'fixtures', 'server-cert.pem');

const server = await tjs.listen('tls', '127.0.0.1', 0, { cert: certPem, key: keyPem });
const { readable: acceptStream, localPort } = await server.opened;

let armed = false;
let closed = false;

function closeServer() {
    if (!closed) {
        closed = true;
        server.close();
    }
}

// fs continuations settle without draining the job queue, so they can still be
// pending when the TLS socket's read callback runs.
let churn = true;
const loops = [];

for (let i = 0; i < 8; i++) {
    loops.push((async () => {
        while (churn) {
            await tjs.stat(fixture);

            if (armed) {
                closeServer();
            }
        }
    })());
}

const proxy = await createCoalescingProxy(localPort, { onFlush: () => {
    armed = true;
} });

const client = await tjs.connect('tls', '127.0.0.1', proxy.port, { verifyPeer: false });
const { writable: cw } = await client.opened;
const writer = cw.getWriter();

await writer.write(new TextEncoder().encode('hello'));

const acceptReader = acceptStream.getReader();
let timer;
const timeout = new Promise(resolve => {
    timer = setTimeout(() => resolve({ timedOut: true }), 1000);
});
const result = await Promise.race([ acceptReader.read(), timeout ]);

clearTimeout(timer);
churn = false;
await Promise.all(loops);

// Either outcome is fine: the connection was accepted before the server
// closed, or the server closed first and the accept stream just ended.
assert.ok(!result.timedOut, 'accept stream settled');

if (!result.done) {
    result.value.close();
}

writer.releaseLock();
client.close();
proxy.close();
closeServer();
