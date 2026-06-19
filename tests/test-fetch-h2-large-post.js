import assert from 'tjs:assert';
import cert from './fixtures/server-cert.pem' with { type: 'text' };
import key from './fixtures/server-key.pem' with { type: 'text' };

// Request bodies of various sizes upload intact over h2. This exercises h2
// send-window flow control and DATA framing: bodies around the 64 KiB
// connection window and bodies spanning multiple windows must not stall (each
// DATA frame, including the final END_STREAM one, has to be emitted whole and
// kept within the peer's window). The sizes include the connection-window
// boundary (65535 +/- 1), which used to hang.
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

async function testLargePostBody() {
    await withServer(
        async req => new Response(`len:${(await req.arrayBuffer()).byteLength}`),
        async port => {
            const sizes = [ 65535, 65536, 131072, 262144, 1048576 ];

            for (const size of sizes) {
                const body = new Uint8Array(size);
                const r = await fetch(`https://127.0.0.1:${port}/post-len`, {
                    method: 'POST',
                    body,
                    allowInsecure: true,
                });

                assert.eq(await r.text(), `len:${size}`, `h2 POST body of ${size} bytes received intact`);
            }
        },
    );
}

await testLargePostBody();
