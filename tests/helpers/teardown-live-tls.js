import certPem from '../fixtures/server-cert.pem' with { type: 'text' };
import keyPem from '../fixtures/server-key.pem' with { type: 'text' };
import caPem from '../fixtures/ca.pem' with { type: 'text' };

// Keep both ends of a TLS connection actively reading, then throw at top level.
// On this abnormal exit the runtime must tear down cleanly (no UAF / crash).
const server = new TLSServerSocket('127.0.0.1', { localPort: 0, cert: certPem, key: keyPem });
const { readable, localPort } = await server.opened;
const acceptReader = readable.getReader();
const client = new TLSSocket('127.0.0.1', localPort, { ca: caPem, sni: '127.0.0.1', verifyPeer: false });
const { readable: cr } = await client.opened;
const { value: srvClient } = await acceptReader.read();
const { readable: scr } = await srvClient.opened;
for (const stream of [ scr, cr ]) {
    (async () => {
        const r = stream.getReader();
        for (;;) {
            const { done } = await r.read();
            if (done) {
                break;
            }
        }
    })();
}
await new Promise(res => setTimeout(res, 60));
throw new Error('uncaught with a live TLS read');
