// Connection-specific request headers (Connection, Keep-Alive,
// Proxy-Connection, Upgrade, Transfer-Encoding, TE other than "trailers") are
// never put on the wire: on h2 they make the message malformed and the server
// answers with GOAWAY, killing every stream on the pooled connection. A user
// "Connection: close" is honored by giving the request its own connection, so
// a pooled h1 connection is never left warm after the server closed it.
//
// Each case runs over plain http, https forced to h1 and https forced to h2
// (the server only advertises one ALPN protocol, so there is no fallback).
import assert from 'tjs:assert';
import path from 'tjs:path';
import cert from './fixtures/server-cert.pem' with { type: 'text' };
import key from './fixtures/server-key.pem' with { type: 'text' };

const transports = [
    { name: 'http', scheme: 'http', version: '1.1' },
    { name: 'https/h1', scheme: 'https', tls: { cert, key, alpn: [ 'http/1.1' ] }, version: '1.1' },
    { name: 'https/h2', scheme: 'https', tls: { cert, key, alpn: [ 'h2' ] }, version: '2' },
];

const dropped = [ 'keep-alive', 'proxy-connection', 'upgrade', 'transfer-encoding', 'te' ];

// A never-settling await (e.g. a server.close() that never finishes) would let
// the loop run dry and exit 0 with the remaining cases skipped.
let completed = false;

addEventListener('beforeunload', () => {
    if (!completed) {
        console.error('test did not run to completion');
        tjs.exit(1);
    }
});

async function withServer(t, handler, fn) {
    const server = tjs.serve({
        port: 0,
        listenIp: '127.0.0.1',
        ...(t.tls ? { tls: t.tls } : {}),
        fetch: handler,
    });

    try {
        return await fn(`${t.scheme}://127.0.0.1:${server.port}/`);
    } finally {
        await server.close();
    }
}

async function echo(req, info) {
    const headers = {};

    for (const [ k, v ] of req.headers) {
        headers[k] = v;
    }

    return Response.json({ version: info.httpVersion, body: await req.text(), headers });
}

function doFetch(url, init = {}) {
    return fetch(url, { allowInsecure: true, ...init });
}

// a. A single "Connection: close" request succeeds; h2 never sees the header.
async function testConnectionClose(t) {
    await withServer(t, echo, async url => {
        const r = await doFetch(url, { method: 'POST', body: 'x', headers: { connection: 'close' } });
        const data = await r.json();

        assert.eq(r.status, 200, `${t.name}: status`);
        assert.eq(data.version, t.version, `${t.name}: http version`);
        assert.eq(data.body, 'x', `${t.name}: body`);

        if (t.version === '2') {
            assert.eq(data.headers.connection, undefined, `${t.name}: no connection header on h2`);
        }
    });
}

// b. Fetches right after a "Connection: close" request don't reuse a dead
// pooled connection.
async function testFollowUp(t) {
    await withServer(t, () => new Response('ok'), async url => {
        const seq = [ {}, {}, { connection: 'close' }, {}, {}, { connection: 'close' }, { connection: 'close' }, {} ];

        for (const [ i, headers ] of seq.entries()) {
            const r = await doFetch(url, { headers });

            assert.eq(r.status, 200, `${t.name}: fetch #${i} status`);
            assert.eq(await r.text(), 'ok', `${t.name}: fetch #${i} body`);
        }
    });
}

// c. Concurrent fetches on a warm connection, one with "Connection: close".
async function testConcurrent(t) {
    const handler = async () => {
        await new Promise(resolve => setTimeout(resolve, 100));

        return new Response('ok');
    };

    await withServer(t, handler, async url => {
        await (await doFetch(url)).text();

        const results = await Promise.all([ 0, 1, 2, 3 ].map(async i => {
            const r = await doFetch(url, { headers: i === 1 ? { connection: 'close' } : {} });

            return `${r.status} ${await r.text()}`;
        }));

        assert.eq(results.join(','), '200 ok,200 ok,200 ok,200 ok', `${t.name}: concurrent fetches`);
    });
}

// d. The other connection-specific headers are dropped; the body is intact.
async function testDropped(t) {
    await withServer(t, echo, async url => {
        const r = await doFetch(url, {
            method: 'POST',
            body: 'payload',
            headers: {
                'keep-alive': '5',
                'proxy-connection': 'keep-alive',
                upgrade: 'foo',
                'transfer-encoding': 'chunked',
                connection: 'keep-alive',
                te: 'gzip',
                'x-kept': 'yes',
            },
        });
        const data = await r.json();

        assert.eq(r.status, 200, `${t.name}: status`);
        assert.eq(data.version, t.version, `${t.name}: http version`);
        assert.eq(data.body, 'payload', `${t.name}: body intact`);
        assert.eq(data.headers['x-kept'], 'yes', `${t.name}: ordinary header kept`);
        assert.eq(data.headers['content-length'], '7', `${t.name}: runtime framing`);

        for (const name of dropped) {
            assert.eq(data.headers[name], undefined, `${t.name}: ${name} dropped`);
        }

        assert.ok(!/keep-alive/i.test(data.headers.connection ?? ''), `${t.name}: user connection value dropped`);
    });
}

// e. "TE: trailers" is legal on h1 and h2 and is passed through, in lowercase:
// h2 peers compare it case-sensitively and GOAWAY on "Trailers".
async function testTeTrailers(t) {
    await withServer(t, echo, async url => {
        const r = await doFetch(url, { headers: { te: ' Trailers ' } });
        const data = await r.json();

        assert.eq(r.status, 200, `${t.name}: status`);
        assert.eq(data.headers.te, 'trailers', `${t.name}: te: trailers reaches the server`);
    });
}

for (const t of transports) {
    await testConnectionClose(t);
    await testFollowUp(t);
    await testConcurrent(t);
    await testDropped(t);
    await testTeTrailers(t);
}

// XMLHttpRequest has no allowInsecure, so run it in a child that trusts the
// fixture CA.
{
    const caPath = path.join(import.meta.dirname, 'fixtures', 'ca.pem');
    const helperPath = path.join(import.meta.dirname, 'helpers', 'xhr-h2-connection-close.js');
    const proc = tjs.spawn([ tjs.exePath, '--tls-ca', caPath, 'run', helperPath ], { stdout: 'pipe', stderr: 'pipe' });
    const [ status, stdout, stderr ] = await Promise.all([ proc.wait(), proc.stdout.text(), proc.stderr.text() ]);

    assert.eq(status.exit_status, 0, `xhr helper failed: ${stderr}`);
    assert.eq(stdout.trim(), '200 v:2 conn:null', 'xhr Connection: close over h2');
}

completed = true;
