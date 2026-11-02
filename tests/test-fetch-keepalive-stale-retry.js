// A keep-alive server may close an idle connection right after a response,
// without "Connection: close", racing the next request put on it: the request
// is written to a socket the server already closed and is never answered. An
// idempotent request with a buffered body gets one more attempt on a fresh
// connection; POST and PATCH are never resent. A request that fails on a
// connection it opened itself is not retried either. The stale connection is
// only half-closed, so the server sees what the client writes onto it: when
// the race is hit, a retry shows up as the same request on both the stale and
// the fresh connection.
import assert from 'tjs:assert';

import { startStaleKeepAliveServer, withWatchdog } from './helpers/stale-keepalive-server.js';

const settle = p => p.then(r => r.text().then(t => `${r.status} ${t}`), e => e.name);

// Reuse the leader's idle connection: the next request goes out with no gap,
// before the client has seen the server's FIN.
async function sequential(send) {
    const s = await startStaleKeepAliveServer();

    try {
        assert.eq(await withWatchdog(settle(fetch(`${s.base}/leader`)), 'leader'), '200 ok /leader');

        const result = await withWatchdog(send(s.base), 'next');

        await withWatchdog(s.staleDone, 'stale connection');

        const next = s.state.requests.filter(r => r.path === '/next');
        const stale = next.filter(r => r.connIndex === 0);
        const fresh = next.filter(r => r.connIndex > 0);

        return { result, stale, fresh, connections: s.state.connections };
    } finally {
        await s.close();
    }
}

// Sent once on a fresh connection, after at most one attempt on the stale one.
function assertRetried(what, method, { stale, fresh, connections }) {
    assert.eq(fresh.length, 1, `${what} reached a fresh connection once`);
    assert.eq(fresh[0].connIndex, 1, `${what} went out on the second connection`);
    assert.eq(fresh[0].method, method, `${what} kept its method`);
    assert.ok(stale.length <= 1, `${what} was written to the stale connection at most once`);

    if (stale.length === 1) {
        assert.eq(fresh[0].method, stale[0].method, `${what} was resent with the same method`);
        assert.eq(fresh[0].body, stale[0].body, `${what} was resent with the same body`);
        assert.eq(fresh[0].probe, stale[0].probe, `${what} was resent with the same headers`);
    }

    assert.eq(connections, 2, `${what}: two connections`);
}

// (a) Idempotent methods are resent once, on a connection of their own.
for (const method of [ 'GET', 'HEAD', 'PUT', 'DELETE', 'OPTIONS' ]) {
    const init = method === 'PUT' ? { method, body: 'x', headers: { 'X-Probe': '1' } } : { method };
    const r = await sequential(base => settle(fetch(`${base}/next`, init)));

    assert.eq(r.result, method === 'HEAD' ? '200 ' : '200 ok /next', `${method} succeeded`);
    assertRetried(method, method, r);

    if (method === 'PUT') {
        assert.eq(r.fresh[0].body, 'x', 'PUT was resent with its body');
        assert.eq(r.fresh[0].probe, '1', 'PUT was resent with its headers');
    }
}

// (b) POST and PATCH are never resent. Where the race isn't hit, the request
// simply goes out on a fresh connection.
for (const method of [ 'POST', 'PATCH' ]) {
    const { result, stale, fresh, connections } = await sequential(base => settle(fetch(`${base}/next`, { method, body: 'x' })));

    assert.ok(stale.length === 0 || fresh.length === 0, `${method} was not sent on both the stale and a fresh connection`);

    if (stale.length === 1) {
        assert.eq(result, 'TypeError', `${method} written to the stale connection failed`);
    }

    if (result === 'TypeError') {
        assert.eq(fresh.length, 0, `${method} was not resent`);
        assert.eq(connections, 1, `${method}: no second connection`);
    } else {
        assert.eq(result, '200 ok /next', `${method} succeeded`);
        assert.eq(stale.length, 0, `${method} did not reach the stale connection`);
        assert.eq(fresh.length, 1, `${method} reached the server once`);
        assert.eq(fresh[0].connIndex, 1, `${method} went out on a fresh connection`);
    }
}

// (c) Requests queued behind the leader: the first one is handed the leader's
// connection after its response, just as the server closes it.
{
    const s = await startStaleKeepAliveServer();

    try {
        const paths = [ '/leader', '/f1', '/f2', '/f3' ];
        const results = await withWatchdog(Promise.all(paths.map(p => settle(fetch(s.base + p)))), 'queued');

        assert.eq(results.join(','), paths.map(p => `200 ok ${p}`).join(','), 'every queued fetch succeeded');

        await withWatchdog(s.staleDone, 'stale connection');

        const { requests } = s.state;
        const leader = requests.filter(r => r.path === '/leader');
        const stale = requests.filter(r => r.connIndex === 0 && r.path !== '/leader');

        assert.eq(leader.length, 1, '/leader reached the server once');
        assert.eq(leader[0].connIndex, 0, '/leader went out on the first connection');

        for (const p of paths.slice(1)) {
            assert.eq(requests.filter(r => r.path === p && r.connIndex > 0).length, 1, `${p} reached a fresh connection once`);
        }

        assert.ok(stale.length <= 1, 'at most one queued request was written to the stale connection');

        for (const r of stale) {
            assert.ok(requests.some(f => f.path === r.path && f.connIndex > 0), `${r.path} was resent after the stale write`);
        }
    } finally {
        await s.close();
    }
}

// (d) A request on a connection of its own is not retried.
{
    const s = await startStaleKeepAliveServer('close-before-reply');

    try {
        const result = await withWatchdog(settle(fetch(`${s.base}/first`)), 'first');

        assert.eq(result, 'TypeError', 'the fetch failed');
        assert.eq(s.state.requests.length, 1, 'it reached the server once');
        assert.eq(s.state.connections, 1, 'no second connection');
    } finally {
        await s.close();
    }
}

// (e) XHR shares the HTTP client.
{
    const xhr = base => new Promise(resolve => {
        const req = new XMLHttpRequest();

        req.onload = () => resolve(`${req.status} ${req.responseText}`);
        req.onerror = () => resolve('error');
        req.open('GET', `${base}/next`);
        req.send();
    });
    const r = await sequential(xhr);

    assert.eq(r.result, '200 ok /next', 'the XHR succeeded');
    assertRetried('the XHR', 'GET', r);
}
