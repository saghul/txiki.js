import assert from 'tjs:assert';
import cert from './fixtures/server-cert.pem' with { type: 'text' };
import key from './fixtures/server-key.pem' with { type: 'text' };

// Reading the body of a bodyless request (e.g. a GET) must resolve to '' and the
// handler must respond normally. Echoing that empty string back exercises an
// empty response body, which over HTTP/2 must still close the stream with
// END_STREAM — otherwise the client hangs and the request fails.
//
// The server advertises only "h2", so the connection is guaranteed to be
// HTTP/2 (a client that can't negotiate h2 fails ALPN rather than downgrading),
// which is the path that regressed. allowInsecure accepts the fixture cert.

async function withServer(handler, fn) {
    const server = tjs.serve({
        port: 0,
        listenIp: '127.0.0.1',
        tls: { cert, key, alpn: [ 'h2' ] },
        fetch: handler,
    });

    try {
        return await fn(server.port);
    } finally {
        await server.close();
    }
}

// Handler reads the request body and echoes it back verbatim.
const echoBody = async req => new Response(await req.text());

async function testBodylessGet() {
    await withServer(echoBody, async port => {
        const r = await fetch(`https://127.0.0.1:${port}/`, { allowInsecure: true });

        assert.eq(r.status, 200, 'bodyless GET handler responds normally');
        assert.eq(await r.text(), '', 'reading a bodyless request body resolves to empty string');
    });
}

async function testEmptyPostBody() {
    await withServer(echoBody, async port => {
        const r = await fetch(`https://127.0.0.1:${port}/`, { allowInsecure: true, method: 'POST', body: '' });

        assert.eq(r.status, 200, 'empty-body POST handler responds normally');
        assert.eq(await r.text(), '', 'reading an empty POST body resolves to empty string');
    });
}

async function testPostBodyRoundTrips() {
    await withServer(echoBody, async port => {
        const r = await fetch(`https://127.0.0.1:${port}/`, { allowInsecure: true, method: 'POST', body: 'hello body' });

        assert.eq(r.status, 200, 'POST handler responds normally');
        assert.eq(await r.text(), 'hello body', 'a POST body still round-trips');
    });
}

await testBodylessGet();
await testEmptyPostBody();
await testPostBodyRoundTrips();
