// HTTP/2: fetches issued while the first fetch to an origin is still setting
// up the connection wait for it (the protocol is not known before ALPN).
// Aborting that first fetch closes the connection before any of them was
// sent: each must get a connection of its own and succeed.
import assert from 'tjs:assert';

import cert from './fixtures/server-cert.pem' with { type: 'text' };
import key from './fixtures/server-key.pem' with { type: 'text' };
import { withWatchdog } from './helpers/delayed-h1-server.js';

const server = tjs.serve({
    port: 0,
    listenIp: '127.0.0.1',
    tls: { cert, key, alpn: [ 'h2' ] },
    fetch: async req => {
        await new Promise(r => setTimeout(r, 100));

        return new Response(`ok ${new URL(req.url).pathname}`);
    },
});

const base = `https://127.0.0.1:${server.port}`;
const settle = p => p.then(r => r.text()).then(t => t, e => `${e.name}: ${e.message}`);
const followers = [ '/f1', '/f2', '/f3' ];
const ac = new AbortController();
const leader = settle(fetch(`${base}/leader`, { allowInsecure: true, signal: ac.signal }));
const others = followers.map(p => settle(fetch(base + p, { allowInsecure: true })));

await new Promise(r => setTimeout(r, 0));
ac.abort();

try {
    const results = await withWatchdog(Promise.all([ leader, ...others ]), 'fetches');

    assert.eq(results[0], 'AbortError: Aborted', 'the leader was aborted');
    assert.eq(results.slice(1).join(','), followers.map(p => `ok ${p}`).join(','), 'every follower got its body');
} finally {
    await server.close();
}
