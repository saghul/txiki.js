import assert from 'tjs:assert';
import cert from './fixtures/server-cert.pem' with { type: 'text' };
import key from './fixtures/server-key.pem' with { type: 'text' };

// An empty request body over h2 is accepted and the request completes. A
// body-bearing method (POST/PUT/PATCH) sends END_STREAM on the HEADERS with no
// Content-Length and no DATA; the server must treat that as a complete empty
// body rather than waiting for one that never arrives (which used to stall the
// request) and must dispatch the handler exactly once (h2 drives the POST
// action callback twice).
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

async function testEmptyBody() {
    await withServer(
        async req => new Response(`len:${(await req.arrayBuffer()).byteLength}`),
        async port => {
            for (const method of [ 'POST', 'PUT', 'PATCH' ]) {
                for (const body of [ '', new Uint8Array(0), undefined ]) {
                    const r = await fetch(`https://127.0.0.1:${port}/post-len`, {
                        method,
                        body,
                        allowInsecure: true,
                    });

                    assert.eq(r.status, 200, `empty ${method} (body=${typeof body}) status`);
                    assert.eq(await r.text(), 'len:0', `empty ${method} (body=${typeof body}) over h2 completes`);
                }
            }
        },
    );
}

await testEmptyBody();
