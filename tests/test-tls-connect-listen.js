import assert from 'tjs:assert';
import certPem from './fixtures/server-cert.pem' with { type: 'text' };
import keyPem from './fixtures/server-key.pem' with { type: 'text' };
import caPem from './fixtures/ca.pem' with { type: 'text' };

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const server = await tjs.listen('tls', '127.0.0.1', 0, {
    cert: certPem,
    key: keyPem,
});

const { readable, localPort } = await server.opened;
const acceptReader = readable.getReader();

const client = await tjs.connect('tls', '127.0.0.1', localPort, {
    ca: caPem,
    sni: '127.0.0.1',
    verifyPeer: false,
});

const { readable: cr, writable: cw } = await client.opened;

// Accept.
const { value: srvClient } = await acceptReader.read();
acceptReader.releaseLock();
const { readable: scr, writable: scw } = await srvClient.opened;

// Round-trip.
const writer = cw.getWriter();
await writer.write(encoder.encode('via tjs.connect'));
const srvReader = scr.getReader();
const { value: data } = await srvReader.read();
assert.eq(decoder.decode(data), 'via tjs.connect', 'tjs.connect round-trip');

srvReader.releaseLock();
writer.releaseLock();
client.close();
srvClient.close();
server.close();
