import assert from 'tjs:assert';
import cert from './fixtures/server-cert.pem' with { type: 'text' };
import key from './fixtures/server-key.pem' with { type: 'text' };

// HTTP/3 request body: a known-size POST body round-trips over h3. req1 (h2)
// teaches lws the origin's Alt-Svc h3 advertisement; after the idle h2
// connection closes, a cold POST is raced over QUIC by lws, so the body is sent
// as H3 DATA frames after the HEADERS and echoed back intact.

// tjs.serve({ http3: true }) binds the QUIC listener on the same ephemeral port
// the TCP listener got; retry a fresh port if that UDP port is already taken.
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

const server = serveH3(async (req, info) => {
    if (req.method === 'POST') {
        return new Response(await req.text(), { headers: { 'x-http-version': info.httpVersion } });
    }

    return new Response('ready', {
        headers: { 'x-http-version': info.httpVersion, 'alt-svc': `h3=":${server.port}"; ma=86400` },
    });
});

const url = `https://127.0.0.1:${server.port}/`;

try {
    // req1 over h2 carries the Alt-Svc header lws learns from.
    const r1 = await fetch(url, { allowInsecure: true });
    await r1.text();
    assert.eq(r1.status, 200, 'req1 status');
    assert.eq(r1.headers.get('x-http-version'), '2', 'req1 served over h2');

    // Drop the idle h2 connection so the POST is a cold connect (keep_warm_secs).
    await new Promise(r => setTimeout(r, 6500));

    // The cold POST is raced over QUIC and its body must arrive intact.
    const payload = 'payload-body-'.repeat(512);
    const r2 = await fetch(url, { allowInsecure: true, method: 'POST', body: payload });

    assert.eq(r2.status, 200, 'req2 status');
    assert.eq(r2.headers.get('x-http-version'), '3', 'cold POST upgraded to h3');
    assert.eq(await r2.text(), payload, 'POST body echoed intact over h3');
} finally {
    await server.close();
}
