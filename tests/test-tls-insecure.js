import assert from 'tjs:assert';
import certPem from './fixtures/server-cert.pem' with { type: 'text' };
import keyPem from './fixtures/server-key.pem' with { type: 'text' };

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
