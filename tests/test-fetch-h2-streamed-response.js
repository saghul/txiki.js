import assert from 'tjs:assert';
import cert from './fixtures/server-cert.pem' with { type: 'text' };
import key from './fixtures/server-key.pem' with { type: 'text' };

// A streamed response with no Content-Length (DATA frames terminated by
// END_STREAM) is received intact over h2, past the connection window. This
// exercises the client's receive path for unbounded/streamed h2 responses.
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

async function testStreamedResponseReceive() {
    await withServer(
        req => {
            const url = new URL(req.url);
            const n = Number(url.searchParams.get('n') || '0');
            const chunk = new Uint8Array(16384).fill(0x78); // 'x'
            let sent = 0;
            const stream = new ReadableStream({
                pull(controller) {
                    if (sent >= n) {
                        controller.close();

                        return;
                    }

                    const len = Math.min(chunk.length, n - sent);

                    controller.enqueue(chunk.subarray(0, len));
                    sent += len;
                },
            });

            return new Response(stream);
        },
        async port => {
            for (const n of [ 400000, 1048576 ]) {
                const r = await fetch(`https://127.0.0.1:${port}/stream?n=${n}`, { allowInsecure: true });

                assert.eq(r.headers.get('content-length'), null, 'streamed response has no content-length');
                assert.eq((await r.arrayBuffer()).byteLength, n, `streamed h2 response of ${n} bytes received intact`);
            }
        },
    );
}

await testStreamedResponseReceive();
