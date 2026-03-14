import assert from 'tjs:assert';
import path from 'tjs:path';

const decoder = new TextDecoder();

const fixturesDir = path.join(import.meta.dirname, 'fixtures');
const certPem = decoder.decode(await tjs.readFile(path.join(fixturesDir, 'server-cert.pem')));
const keyPem = decoder.decode(await tjs.readFile(path.join(fixturesDir, 'server-key.pem')));

const server = new TLSServerSocket('127.0.0.1', {
    localPort: 0,
    cert: certPem,
    key: keyPem,
});

const { readable, localPort } = await server.opened;
const acceptReader = readable.getReader();

const client = new TLSSocket('127.0.0.1', localPort, {
    verifyPeer: false,
    sni: '127.0.0.1',
});

const { readable: cr } = await client.opened;
assert.ok(cr, 'connected with verifyPeer: false');

// Accept and verify server side also worked.
const { value: srvClient } = await acceptReader.read();
acceptReader.releaseLock();
await srvClient.opened;

client.close();
srvClient.close();
server.close();
