import assert from 'tjs:assert';
import cert from './fixtures/server-cert.pem' with { type: 'text' };
import key from './fixtures/server-key.pem' with { type: 'text' };
import { rawH2Request } from './helpers/raw-h2-client.js';

// An h2 request body needs no content-length: DATA frames up to END_STREAM
// frame it. The handler must see the whole body, and answer only after it,
// not an empty one at the HEADERS. An empty body (END_STREAM on the HEADERS)
// must still end, whatever the method.

let calls = 0;
const server = tjs.serve({
    port: 0,
    listenIp: '127.0.0.1',
    tls: { cert, key, alpn: [ 'h2' ] },
    fetch: async req => {
        calls++;

        return new Response(`${req.method} ${JSON.stringify(await req.text())}`);
    },
});

try {
    const streamed = await rawH2Request(server.port, 'PUT', '/up', [ 'xxxxxxxxxx', 100, 'yyyyyyyyyy', 100, 'zzzzzzzzzz', 'end' ]);

    assert.eq(streamed, `PUT "${'x'.repeat(10)}${'y'.repeat(10)}${'z'.repeat(10)}"`, 'streamed no-CL body arrives whole');

    const oneFrame = await rawH2Request(server.port, 'POST', '/up', [ 'hello', 'end' ]);

    assert.eq(oneFrame, 'POST "hello"', 'no-CL body in one DATA frame arrives whole');

    for (const method of [ 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'GET' ]) {
        assert.eq(await rawH2Request(server.port, method, '/'), `${method} ""`, `empty no-CL ${method} body ends`);
    }

    assert.eq(calls, 8, 'the handler runs once per request');
} finally {
    await server.close();
}
