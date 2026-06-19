import assert from 'tjs:assert';
import cert from './fixtures/server-cert.pem' with { type: 'text' };
import key from './fixtures/server-key.pem' with { type: 'text' };

// A large response body is received intact over h2 (exercises framing and flow
// control: 256 KiB exceeds the default 64 KiB connection window, so it requires
// WINDOW_UPDATE handling on the client receive path).
//
// The server advertises only "h2" via tls.alpn, so the connection must be
// HTTP/2: a client that can't negotiate h2 fails the ALPN handshake rather than
// downgrading, so this test can never pass over HTTP/1.1 by accident.
// allowInsecure accepts the self-signed fixture certificate.

const LARGE = 'x'.repeat(256 * 1024);

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

async function testLargeResponseReceive() {
    await withServer(
        () => new Response(LARGE),
        async port => {
            const r = await fetch(`https://127.0.0.1:${port}/large`, { allowInsecure: true });
            const body = await r.text();

            assert.eq(r.status, 200, 'status is 200');
            assert.eq(body.length, LARGE.length, 'large response length matches over h2');
            assert.eq(body, LARGE, 'large response content matches over h2');
        },
    );
}

await testLargeResponseReceive();
