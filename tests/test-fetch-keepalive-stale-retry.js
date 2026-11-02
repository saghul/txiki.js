// A keep-alive server may close an idle connection right after a response,
// without "Connection: close", racing the next request put on it: the request
// is written to a socket the server already closed and is never read. An
// idempotent request with a buffered body gets one more attempt on a fresh
// connection; POST and PATCH are never resent. A request that fails on a
// connection it opened itself is not retried either.
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
        const next = s.state.requests.filter(r => r.path === '/next');

        return { result, next, connections: s.state.connections };
    } finally {
        await s.close();
    }
}

// (a) Idempotent methods are resent once, on a connection of their own.
for (const method of [ 'GET', 'HEAD', 'PUT', 'DELETE', 'OPTIONS' ]) {
    const init = method === 'PUT' ? { method, body: 'x', headers: { 'X-Probe': '1' } } : { method };
    const { result, next, connections } = await sequential(base => settle(fetch(`${base}/next`, init)));

    assert.eq(result, method === 'HEAD' ? '200 ' : '200 ok /next', `${method} succeeded`);
    assert.eq(next.length, 1, `${method} reached the server once`);
    assert.eq(next[0].connIndex, 1, `${method} went out on a fresh connection`);
    assert.eq(next[0].method, method, `${method} kept its method`);
    assert.eq(connections, 2, `${method}: two connections`);

    if (method === 'PUT') {
        assert.eq(next[0].body, 'x', 'PUT was resent with its body');
        assert.eq(next[0].probe, '1', 'PUT was resent with its headers');
    }
}

// (b) POST and PATCH are never resent. Where the race isn't hit, the request
// simply goes out on a fresh connection.
for (const method of [ 'POST', 'PATCH' ]) {
    const { result, next, connections } = await sequential(base => settle(fetch(`${base}/next`, { method, body: 'x' })));

    if (result === 'TypeError') {
        assert.eq(next.length, 0, `${method} was not resent`);
        assert.eq(connections, 1, `${method}: no second connection`);
    } else {
        assert.eq(result, '200 ok /next', `${method} succeeded`);
        assert.eq(next.length, 1, `${method} reached the server once`);
        assert.eq(next[0].connIndex, 1, `${method} went out on a fresh connection`);
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

        for (const p of paths) {
            assert.eq(s.state.requests.filter(r => r.path === p).length, 1, `${p} reached the server once`);
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
    const { result, next, connections } = await sequential(xhr);

    assert.eq(result, '200 ok /next', 'the XHR succeeded');
    assert.eq(next.length, 1, 'the XHR reached the server once');
    assert.eq(next[0].connIndex, 1, 'the XHR went out on a fresh connection');
    assert.eq(connections, 2, 'XHR: two connections');
}
