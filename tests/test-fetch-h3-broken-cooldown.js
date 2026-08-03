import assert from 'tjs:assert';

import cert from './fixtures/server-cert.pem' with { type: 'text' };
import key from './fixtures/server-key.pem' with { type: 'text' };

// After an h3 attempt fails, the origin goes on a cooldown so later requests do
// not keep paying for it. Dropping the Alt-Svc entry is not enough on its own:
// the h1/h2 response the fallback produces carries the same `alt-svc` header,
// which would re-arm the origin and make every request pay the h3 timeout again.

// Deliberately well above the assertion below, so a req3 that did retry h3 is
// unambiguously slower than one that skipped it.
tjs.env.TJS_H3_TIMEOUT = '1000';

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
    await (await fetch(url, { allowInsecure: true })).text(); // learn h3
    await (await fetch(url, { allowInsecure: true })).text(); // fail h3, fall back

    // The third request must not retry h3, even though the second response
    // advertised it again.
    const t = Date.now();
    const r3 = await fetch(url, { allowInsecure: true });
    const elapsed = Date.now() - t;

    assert.eq(r3.status, 200, 'req3 status');
    assert.ok(elapsed < 400, `req3 did not retry h3 (took ${elapsed}ms)`);
} finally {
    await server.close();
}
