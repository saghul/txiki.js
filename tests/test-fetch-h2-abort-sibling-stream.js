// HTTP/2: aborting one fetch multiplexed on a pooled connection ends only its
// own stream; the fetches sharing the connection still get their responses.
import assert from 'tjs:assert';

import cert from './fixtures/server-cert.pem' with { type: 'text' };
import key from './fixtures/server-key.pem' with { type: 'text' };
import { withWatchdog } from './helpers/delayed-h1-server.js';

const server = tjs.serve({
    port: 0,
    listenIp: '127.0.0.1',
    tls: { cert, key, alpn: [ 'h2' ] },
    fetch: async req => {
        await new Promise(r => setTimeout(r, 300));

        return new Response(`ok ${new URL(req.url).pathname}`);
    },
});

const base = `https://127.0.0.1:${server.port}`;
const paths = [ '/r0', '/r1', '/r2', '/r3' ];
const acs = paths.map(() => new AbortController());
const settle = p => p.then(r => r.text()).then(t => t, e => e.name);
const all = Promise.all(paths.map((p, i) => settle(fetch(base + p, { allowInsecure: true, signal: acs[i].signal }))));

// Every stream is open and waiting for its response by now.
await new Promise(r => setTimeout(r, 100));
acs[2].abort();

try {
    const results = await withWatchdog(all, 'fetches');

    assert.eq(results.join(','), 'ok /r0,ok /r1,AbortError,ok /r3', 'only the aborted stream failed');
} finally {
    await server.close();
}
