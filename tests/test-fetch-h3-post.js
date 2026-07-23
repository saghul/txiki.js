import assert from 'tjs:assert';
import cert from './fixtures/server-cert.pem' with { type: 'text' };
import key from './fixtures/server-key.pem' with { type: 'text' };

// HTTP/3 request body: a known-size POST body round-trips over h3. The first
// (h2) request learns the server's Alt-Svc h3 advertisement; the second
// request carries a body and auto-upgrades to h3, so the body is sent as H3
// DATA frames after the HEADERS and echoed back intact.

async function withServer(handler, fn) {
    // tjs.serve({ http3: true }) binds the QUIC listener on the same ephemeral
    // port the TCP listener was auto-assigned; that UDP port is occasionally
    // already taken, which surfaces as "failed to create HTTP/3 (QUIC)
    // listener". Retry with a fresh port so the race does not flake the test.
    let server;
    for (let attempt = 0; ; attempt++) {
        try {
            server = tjs.serve({
                port: 0,
                listenIp: '127.0.0.1',
                tls: { cert, key },
                http3: true,
                fetch: handler,
            });
            break;
        } catch (e) {
            if (attempt < 10 && /HTTP\/3 \(QUIC\) listener/.test(e.message)) {
                continue;
            }

            throw e;
        }
    }

    try {
        return await fn(server.port);
    } finally {
        await server.close();
    }
}

await withServer(
    async (req, info) => {
        if (req.method === 'POST') {
            return new Response(await req.text(), {
                headers: { 'x-http-version': info.httpVersion },
            });
        }

        return new Response('ready', {
            headers: { 'x-http-version': info.httpVersion },
        });
    },
    async port => {
        const url = `https://127.0.0.1:${port}/`;

        // First request goes over TCP (h2) and carries the Alt-Svc header.
        const r1 = await fetch(url, { allowInsecure: true });
        await r1.text();
        assert.eq(r1.status, 200, 'req1 status');
        assert.eq(r1.headers.get('x-http-version'), '2', 'req1 served over h2');

        // The POST auto-upgrades to h3 and its body must arrive intact.
        const payload = 'payload-body-'.repeat(512);
        const r2 = await fetch(url, {
            allowInsecure: true,
            method: 'POST',
            body: payload,
        });

        assert.eq(r2.status, 200, 'req2 status');
        assert.eq(r2.headers.get('x-http-version'), '3', 'req2 auto-upgraded to h3');
        assert.eq(await r2.text(), payload, 'POST body echoed intact over h3');
    },
);
