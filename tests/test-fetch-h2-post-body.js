import assert from 'tjs:assert';
import cert from './fixtures/server-cert.pem' with { type: 'text' };
import key from './fixtures/server-key.pem' with { type: 'text' };

// A request body (POST) is delivered correctly over h2.
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

async function testPostBodyOverH2() {
    await withServer(
        async (req, info) => new Response(`v:${info.httpVersion}|${await req.text()}`),
        async port => {
            const r = await fetch(`https://127.0.0.1:${port}/echo-body`, {
                method: 'POST',
                body: 'hello-over-h2',
                allowInsecure: true,
            });

            assert.eq(await r.text(), 'v:2|hello-over-h2', 'POST sent over h2 and body echoed back');
        },
    );
}

await testPostBodyOverH2();
