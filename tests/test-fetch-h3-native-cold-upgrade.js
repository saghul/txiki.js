import assert from 'tjs:assert';
import cert from './fixtures/server-cert.pem' with { type: 'text' };
import key from './fixtures/server-key.pem' with { type: 'text' };

// HTTP/3 auto-upgrade, driven entirely by lws (no JS involvement).
//
// lws learns the origin's h3 Alt-Svc from a response, then reuses the warm h2
// connection while it lasts and only races QUIC-first on a *cold* connect — so:
//   req1        -> h2, lws learns h3.
//   req2        -> warm h2 reused (no upgrade, no QUIC handshake cost).
//   idle > 5s   -> the client drops the idle h2 connection (keep_warm_secs).
//   req3 (cold) -> lws races QUIC first from its Alt-Svc cache -> h3.
// The server serves real h3 (UDP) alongside h1/h2 and echoes the negotiated
// version so the upgrade is directly observable.

// tjs.serve({ http3: true }) binds the QUIC listener on the same ephemeral port
// the TCP listener got; that UDP port is occasionally already taken, surfacing
// as "failed to create HTTP/3 (QUIC) listener". Retry with a fresh port.
function serveH3(handler) {
    for (let attempt = 0; ; attempt++) {
        try {
            return tjs.serve({ port: 0, listenIp: '127.0.0.1', tls: { cert, key }, http3: true, fetch: handler });
        } catch (e) {
            if (attempt < 10 && /HTTP\/3 \(QUIC\) listener/.test(e.message)) {
                continue;
            }

            throw e;
        }
    }
}

const server = serveH3((_req, info) => new Response(info.httpVersion, {
    headers: { 'alt-svc': `h3=":${server.port}"; ma=86400` },
}));

const url = `https://127.0.0.1:${server.port}/`;

try {
    const r1 = await fetch(url, { allowInsecure: true });
    assert.eq(await r1.text(), '2', 'req1 served over h2');
    assert.ok(/h3=/.test(r1.headers.get('alt-svc') ?? ''), 'req1 advertises h3');

    // Warm reuse: still h2, no forced upgrade.
    const r2 = await fetch(url, { allowInsecure: true });
    assert.eq(await r2.text(), '2', 'req2 reused the warm h2 connection');

    // Let the idle h2 connection close (client keep_warm_secs default is 5s).
    await new Promise(r => setTimeout(r, 6500));

    // Cold connect: lws races QUIC first and upgrades to h3 on its own.
    const r3 = await fetch(url, { allowInsecure: true });
    assert.eq(r3.status, 200, 'req3 status');
    assert.eq(await r3.text(), '3', 'req3 upgraded to h3 on a cold connect');
} finally {
    await server.close();
}
