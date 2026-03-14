import assert from 'tjs:assert';
import path from 'tjs:path';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const fixturesDir = path.join(import.meta.dirname, 'fixtures');
const certPem = decoder.decode(await tjs.readFile(path.join(fixturesDir, 'server-cert.pem')));
const keyPem = decoder.decode(await tjs.readFile(path.join(fixturesDir, 'server-key.pem')));
const caPem = decoder.decode(await tjs.readFile(path.join(fixturesDir, 'ca.pem')));

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
