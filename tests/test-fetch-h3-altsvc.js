import assert from 'tjs:assert';
import cert from './fixtures/server-cert.pem' with { type: 'text' };
import key from './fixtures/server-key.pem' with { type: 'text' };

// HTTP/3 end-to-end over QUIC. The server serves h3 (UDP) alongside h1/h2 and
// advertises it with an Alt-Svc header; the fetch client learns that from the
// first (h2) response and auto-upgrades the next same-origin request to h3.
// A single test that exercises both the client and server h3 paths.

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
    (_req, info) => new Response('hello h3', { headers: { 'x-http-version': info.httpVersion } }),
    async port => {
        const url = `https://127.0.0.1:${port}/`;

        // First request goes over TCP (h2) and carries the Alt-Svc header.
        const r1 = await fetch(url, { allowInsecure: true });
        const b1 = await r1.text();

        assert.eq(r1.status, 200, 'req1 status');
        assert.eq(b1, 'hello h3', 'req1 body');
        assert.eq(r1.headers.get('x-http-version'), '2', 'req1 served over h2');
        assert.ok(/h3=/.test(r1.headers.get('alt-svc') ?? ''), 'req1 advertises h3 via alt-svc');

        // Next request to the same origin auto-upgrades to h3.
        const r2 = await fetch(url, { allowInsecure: true });
        const b2 = await r2.text();

        assert.eq(r2.status, 200, 'req2 status');
        assert.eq(b2, 'hello h3', 'req2 body');
        assert.eq(r2.headers.get('x-http-version'), '3', 'req2 auto-upgraded to h3');
    },
);
