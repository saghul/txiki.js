import assert from 'tjs:assert';
import cert from './fixtures/server-cert.pem' with { type: 'text' };
import key from './fixtures/server-key.pem' with { type: 'text' };

// A standard fetch() reaches an h2-only server over HTTP/2.
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

async function testClientNegotiatesH2() {
    await withServer(
        (req, info) => {
            const url = new URL(req.url);

            return new Response(`path:${url.pathname} v:${info.httpVersion}`);
        },
        async port => {
            const r = await fetch(`https://127.0.0.1:${port}/ping`, { allowInsecure: true });

            assert.eq(r.status, 200, 'status is 200');
            assert.eq(await r.text(), 'path:/ping v:2', 'fetch sent the request over HTTP/2');
        },
    );
}

await testClientNegotiatesH2();
