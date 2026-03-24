import assert from 'tjs:assert';
import certPem from './fixtures/server-cert.pem' with { type: 'text' };
import keyPem from './fixtures/server-key.pem' with { type: 'text' };
import caPem from './fixtures/ca.pem' with { type: 'text' };

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const server = new TLSServerSocket('127.0.0.1', {
    localPort: 0,
    cert: certPem,
    key: keyPem,
});

const { readable, localPort } = await server.opened;
const acceptReader = readable.getReader();

const client = new TLSSocket('127.0.0.1', localPort, {
    ca: caPem,
    sni: '127.0.0.1',
    verifyPeer: false,
});

const { readable: cr, writable: cw } = await client.opened;

// Get server-side client.
const { value: srvClient } = await acceptReader.read();
acceptReader.releaseLock();
const { readable: scr, writable: scw } = await srvClient.opened;

// Send data from client.
const writer = cw.getWriter();
await writer.write(encoder.encode('hello TLS!'));

// Read on server side.
const srvReader = scr.getReader();
const { value: received } = await srvReader.read();
assert.eq(decoder.decode(received), 'hello TLS!', 'server received message');

// Echo back.
const srvWriter = scw.getWriter();
await srvWriter.write(received);

// Read on client side.
const clientReader = cr.getReader();
const { value: echoed } = await clientReader.read();
assert.eq(decoder.decode(echoed), 'hello TLS!', 'client received echo');

// Cleanup.
clientReader.releaseLock();
writer.releaseLock();
srvReader.releaseLock();
srvWriter.releaseLock();
client.close();
srvClient.close();
server.close();
