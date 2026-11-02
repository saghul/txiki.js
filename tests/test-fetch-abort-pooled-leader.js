// Fetches issued while another fetch to the same origin is setting up its
// connection, or waiting for its response, are queued on that fetch's
// connection. Aborting that first fetch (the leader) closes its connection,
// but the queued fetches were never sent: each must get a connection of its
// own and succeed, not fail with "Network request failed".
import assert from 'tjs:assert';

import { startDelayedServer, withWatchdog } from './helpers/delayed-h1-server.js';

const settle = p => p.then(r => r.text()).then(t => t, e => `${e.name}: ${e.message}`);
const followers = [ '/f1', '/f2', '/f3' ];

// 0 ms: the leader is aborted before its connection is up. 60 ms: its request
// is on the wire and the server is holding the response.
for (const abortAfter of [ 0, 60 ]) {
    const what = `abort after ${abortAfter} ms`;
    const { server, base, state } = await startDelayedServer(() => 150);
    const ac = new AbortController();
    const leader = settle(fetch(`${base}/leader`, { signal: ac.signal }));
    const others = followers.map(p => settle(fetch(base + p)));

    await new Promise(r => setTimeout(r, abortAfter));
    ac.abort();

    const results = await withWatchdog(Promise.all([ leader, ...others ]), what);

    assert.eq(results[0], 'AbortError: Aborted', `${what}: the leader was aborted`);
    assert.eq(results.slice(1).join(','), followers.map(p => `ok ${p}`).join(','), `${what}: every follower got its body`);

    for (const p of followers) {
        assert.eq(state.paths.filter(x => x === p).length, 1, `${what}: server saw ${p} once (${state.paths.join(',')})`);
    }

    if (abortAfter > 0) {
        assert.eq(state.connections, 1 + followers.length, `${what}: one fresh connection per follower`);
    }

    await server.close();
}
