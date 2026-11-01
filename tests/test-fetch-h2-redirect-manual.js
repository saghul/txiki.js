import assert from 'tjs:assert';
import cert from './fixtures/server-cert.pem' with { type: 'text' };
import key from './fixtures/server-key.pem' with { type: 'text' };

// redirect: 'manual' must hand back the redirect itself over h2 too, including
// on the first request of a fresh connection: lws moves that request onto h2
// stream 1 once ALPN picks h2, and the no-follow preference has to move with
// it or lws follows the redirect on its own.
//
// The server advertises only "h2" via tls.alpn, so the connection must be
// HTTP/2. allowInsecure accepts the self-signed fixture certificate.

const seen = [];
const server = tjs.serve({
    port: 0,
    listenIp: '127.0.0.1',
    tls: { cert, key, alpn: [ 'h2' ] },
    fetch: req => {
        const { pathname } = new URL(req.url);

        seen.push(pathname);

        if (pathname === '/start') {
            return new Response(null, { status: 302, headers: { location: '/target' } });
        }

        return new Response('followed');
    },
});

try {
    const r = await fetch(`https://127.0.0.1:${server.port}/start`, {
        redirect: 'manual',
        allowInsecure: true,
    });

    await r.arrayBuffer();

    assert.eq(r.status, 302, 'redirect status returned, not followed');
    assert.eq(r.headers.get('location'), '/target', 'location header returned');
    assert.eq(seen, [ '/start' ], 'redirect target never requested');
} finally {
    await server.close();
}
