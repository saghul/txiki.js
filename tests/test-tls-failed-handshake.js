import assert from 'tjs:assert';
import certPem from './fixtures/server-cert.pem' with { type: 'text' };
import keyPem from './fixtures/server-key.pem' with { type: 'text' };

// A failed client handshake must be scoped to that one connection: the
// server's accept stream keeps producing later connections instead of
// erroring permanently, and server.close() still completes cleanly.

const server = await tjs.listen('tls', '127.0.0.1', 0, {
    cert: certPem,
    key: keyPem,
});

const { readable, localPort } = await server.opened;
const reader = readable.getReader();

// 1. A client that rejects our self-signed certificate (verifyPeer defaults
// to true) — its handshake fails on both sides.
let failed = false;

try {
    await tjs.connect('tls', '127.0.0.1', localPort, { sni: '127.0.0.1' });
} catch {
    failed = true;
}

assert.ok(failed, 'verifying client rejects the self-signed certificate');

// 2. The same server must still accept a permissive client and carry data.
const client = await tjs.connect('tls', '127.0.0.1', localPort, {
    sni: '127.0.0.1',
    verifyPeer: false,
});

const accepted = await reader.read();

assert.ok(!accepted.done, 'accept stream is still alive after a failed handshake');

const srvConn = accepted.value;
const { readable: sr, writable: sw } = await srvConn.opened;
const { readable: cr, writable: cw } = await client.opened;

const cWriter = cw.getWriter();

await cWriter.write(new TextEncoder().encode('ping'));

const srvReader = sr.getReader();
const { value: got } = await srvReader.read();

assert.eq(new TextDecoder().decode(got), 'ping', 'data flows on the post-failure connection');

const sWriter = sw.getWriter();

await sWriter.write(new TextEncoder().encode('pong'));

const cReader = cr.getReader();
const { value: echo } = await cReader.read();

assert.eq(new TextDecoder().decode(echo), 'pong', 'data flows back');

client.close();
srvConn.close();
srvReader.releaseLock();
cReader.releaseLock();
reader.releaseLock();

// 3. Closing the server after all of the above must not throw.
server.close();

const endReader = readable.getReader();
const { done } = await endReader.read();

assert.eq(done, true, 'accept stream closes cleanly after server.close()');
