import assert from 'tjs:assert';
import cert from './fixtures/server-cert.pem' with { type: 'text' };
import key from './fixtures/server-key.pem' with { type: 'text' };

// Many concurrent requests over a single h2 connection all succeed (exercises
// mux substreams).
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

async function testConcurrentRequests() {
    await withServer(
        (req, info) => {
            const url = new URL(req.url);

            return new Response(`path:${url.pathname} v:${info.httpVersion}`);
        },
        async port => {
            const n = 20;
            const bodies = await Promise.all(
                Array.from({ length: n }, (_, i) =>
                    fetch(`https://127.0.0.1:${port}/req-${i}`, { allowInsecure: true }).then(r => r.text())),
            );

            for (let i = 0; i < n; i++) {
                assert.eq(bodies[i], `path:/req-${i} v:2`, `concurrent h2 request ${i} ok`);
            }
        },
    );
}

await testConcurrentRequests();
