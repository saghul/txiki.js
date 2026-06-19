import assert from 'tjs:assert';
import cert from './fixtures/server-cert.pem' with { type: 'text' };
import key from './fixtures/server-key.pem' with { type: 'text' };

// A streaming response (ReadableStream) is assembled correctly over h2.
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

async function testStreamingResponse() {
    const enc = new TextEncoder();

    await withServer(
        () => new Response(new ReadableStream({
            start(controller) {
                controller.enqueue(enc.encode('chunk-1;'));
                controller.enqueue(enc.encode('chunk-2;'));
                controller.close();
            },
        })),
        async port => {
            const r = await fetch(`https://127.0.0.1:${port}/`, { allowInsecure: true });

            assert.eq(await r.text(), 'chunk-1;chunk-2;', 'streamed body assembled over h2');
        },
    );
}

await testStreamingResponse();
