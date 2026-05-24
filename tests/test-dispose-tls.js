import assert from 'tjs:assert';
import certPem from './fixtures/server-cert.pem' with { type: 'text' };
import keyPem from './fixtures/server-key.pem' with { type: 'text' };
import caPem from './fixtures/ca.pem' with { type: 'text' };

// 1) `await using` on a TLSServerSocket.
let serverRef;
{
    await using server = await tjs.listen('tls', '127.0.0.1', 0, {
        cert: certPem,
        key: keyPem,
    });

    serverRef = server;
    assert.ok(server instanceof TLSServerSocket, 'is a TLSServerSocket');

    const opened = await server.opened;

    assert.ok(opened.localPort > 0, 'has a port');
}

await serverRef.closed;

// 2) `await using` on a TLSSocket (client).
const server2 = await tjs.listen('tls', '127.0.0.1', 0, {
    cert: certPem,
    key: keyPem,
});
const { readable: srvReadable, localPort: port2 } = await server2.opened;
const acceptReader = srvReadable.getReader();

// Server-side: accept one conn, read from it (drains until FIN), close.
async function acceptAndDrain() {
    const { value: conn } = await acceptReader.read();

    if (!conn) {
        return;
    }

    const { readable } = await conn.opened;
    const r = readable.getReader();

    try {
        while (true) {
            const { done } = await r.read();

            if (done) {
                break;
            }
        }
    } catch {
        // ignore
    }

    try {
        conn.close();
    } catch {
        // ignore
    }
}

const acceptPromise = acceptAndDrain();

let clientRef;
{
    await using client = await tjs.connect('tls', '127.0.0.1', port2, {
        ca: caPem,
        sni: '127.0.0.1',
        verifyPeer: false,
    });

    clientRef = client;
    assert.ok(client instanceof TLSSocket, 'is a TLSSocket');
}

await clientRef.closed;
await acceptPromise;

// 3) Idempotency.
const acceptPromise2 = acceptAndDrain();
{
    const client = await tjs.connect('tls', '127.0.0.1', port2, {
        ca: caPem,
        sni: '127.0.0.1',
        verifyPeer: false,
    });

    client.close();
    await client.closed;
    await client[Symbol.asyncDispose]();
    await client[Symbol.asyncDispose]();
}
await acceptPromise2;

server2.close();
