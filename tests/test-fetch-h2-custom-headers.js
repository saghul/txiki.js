import assert from 'tjs:assert';
import cert from './fixtures/server-cert.pem' with { type: 'text' };
import key from './fixtures/server-key.pem' with { type: 'text' };

// Custom (non-token) headers are delivered in both directions over h2: the
// client sends one in the request and reads several from the response. h2
// carries headers via HPACK, not the h1 text parser, so this exercises the
// hpack-side unknown-header capture.
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

async function testCustomHeaders() {
    await withServer(
        (req, info) => new Response(`v:${info.httpVersion} req:${req.headers.get('x-req-custom')}`, {
            headers: {
                'x-resp-custom': 'resp-value',
                'x-resp-empty': '',
                'x-resp-spaced': 'a value with spaces',
            },
        }),
        async port => {
            const r = await fetch(`https://127.0.0.1:${port}/custom-headers`, {
                headers: { 'x-req-custom': 'req-value' },
                allowInsecure: true,
            });

            assert.eq(await r.text(), 'v:2 req:req-value', 'server received custom request header over h2');
            assert.eq(r.headers.get('x-resp-custom'), 'resp-value', 'client received custom response header over h2');
            assert.eq(r.headers.get('x-resp-empty'), '', 'client received empty-valued custom response header');
            assert.eq(r.headers.get('x-resp-spaced'), 'a value with spaces', 'custom response header value with spaces preserved');
        },
    );
}

await testCustomHeaders();
