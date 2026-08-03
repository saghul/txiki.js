import assert from 'tjs:assert';

import cert from './fixtures/server-cert.pem' with { type: 'text' };
import key from './fixtures/server-key.pem' with { type: 'text' };

// An origin that advertises h3 over Alt-Svc but whose QUIC path does not answer
// (here: no QUIC listener at all; in the field: a firewall dropping :443/udp).
// A blackholed UDP path reports no error, so without a bound on the handshake
// the h3 attempt only fails when the whole connect times out — 20s. TJS_H3_TIMEOUT
// bounds it, and the request then falls back to h1/h2.

tjs.env.TJS_H3_TIMEOUT = '300'; // keep the test quick; read per attempt

const server = tjs.serve({
    port: 0,
    listenIp: '127.0.0.1',
    tls: { cert, key },
    fetch: (_req, info) => new Response(info.httpVersion, {
        headers: { 'alt-svc': `h3=":${server.port}"; ma=86400` },
    }),
});

const url = `https://127.0.0.1:${server.port}/`;

try {
    // Teaches the client that this origin claims h3.
    const r1 = await fetch(url, { allowInsecure: true });

    assert.eq(await r1.text(), '2', 'req1 served over h2');
    assert.ok(/h3=/.test(r1.headers.get('alt-svc') ?? ''), 'req1 advertises h3');

    // Tries h3, gets nothing, falls back rather than failing.
    const t = Date.now();
    const r2 = await fetch(url, { allowInsecure: true });
    const elapsed = Date.now() - t;

    assert.eq(r2.status, 200, 'req2 status');
    assert.eq(await r2.text(), '2', 'req2 fell back to h2');
    assert.ok(elapsed < 10000, `req2 fell back promptly (took ${elapsed}ms)`);
} finally {
    await server.close();
}
