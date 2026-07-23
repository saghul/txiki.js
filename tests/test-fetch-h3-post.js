import assert from 'tjs:assert';
import cert from './fixtures/server-cert.pem' with { type: 'text' };
import key from './fixtures/server-key.pem' with { type: 'text' };

// Enabling HTTP/3 on a server must not disturb ordinary request-body handling:
// a POST body still round-trips (over h1/h2 — the h3 auto-upgrade is
// bodyless-only) against an h3-enabled server.

async function withServer(handler, fn) {
    const server = tjs.serve({
        port: 0,
        listenIp: '127.0.0.1',
        tls: { cert, key },
        http3: true,
        fetch: handler,
    });

    try {
        return await fn(server.port);
    } finally {
        await server.close();
    }
}

await withServer(
    async req => new Response(await req.text()),
    async port => {
        const payload = 'payload-body-'.repeat(512);
        const r = await fetch(`https://127.0.0.1:${port}/`, {
            allowInsecure: true,
            method: 'POST',
            body: payload,
        });

        assert.eq(r.status, 200, 'status 200');
        assert.eq(await r.text(), payload, 'POST body echoed intact');
    },
);
