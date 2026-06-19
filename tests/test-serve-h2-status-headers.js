import assert from 'tjs:assert';
import cert from './fixtures/server-cert.pem' with { type: 'text' };
import key from './fixtures/server-key.pem' with { type: 'text' };

// A non-200 status code and a response header survive the h2 path. (Custom,
// non-token response headers over h2 are exercised in test-fetch-h2-custom-headers.js.)
//
// The server advertises only "h2" via tls.alpn, so the connection must be
// HTTP/2: a client that can't negotiate h2 fails the ALPN handshake rather than
// downgrading, so this test can never pass over HTTP/1.1 by accident.
// allowInsecure accepts the self-signed fixture certificate.

async function withServer(handler, fn) {
    const server = tjs.serve({
        port: 0,
        listenIp: '127.0.0.1',
        tls: { cert, key, alpn: [ 'h2' ] },
        fetch: handler,
    });

    try {
        return await fn(server.port);
    } finally {
        await server.close();
    }
}

async function testStatusAndHeaders() {
    await withServer(
        () => new Response('teapot', { status: 418, headers: { 'content-type': 'application/x-h2-test' } }),
        async port => {
            const r = await fetch(`https://127.0.0.1:${port}/`, { allowInsecure: true });

            assert.eq(r.status, 418, 'custom status preserved over h2');
            assert.eq(r.headers.get('content-type'), 'application/x-h2-test', 'response content-type preserved over h2');
            assert.eq(await r.text(), 'teapot', 'body preserved over h2');
        },
    );
}

await testStatusAndHeaders();
