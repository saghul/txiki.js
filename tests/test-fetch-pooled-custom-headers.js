import assert from 'tjs:assert';
import cert from './fixtures/server-cert.pem' with { type: 'text' };
import key from './fixtures/server-key.pem' with { type: 'text' };

// A custom (non-token) response header must survive connection pooling over
// HTTP/2: request 1 opens the connection, requests 2+ reuse it via a new
// multiplexed stream. A reused stream must populate the header table's
// unknown-header list the same as the first stream — otherwise reading a custom
// response header walks a stale list and reads out of bounds (heap UAF), and the
// header is silently dropped. Server advertises only "h2" via alpn so the
// connection must be HTTP/2.

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

await withServer(
    () => new Response('x', { headers: { 'x-custom-header': 'some-value' } }),
    async port => {
        const url = `https://127.0.0.1:${port}/`;

        for (let i = 1; i <= 3; i++) {
            const r = await fetch(url, { allowInsecure: true });

            assert.eq(r.status, 200, `request ${i} status`);
            assert.eq(r.headers.get('x-custom-header'), 'some-value',
                      `request ${i} custom response header over pooled h2`);
            assert.eq(await r.text(), 'x', `request ${i} body`);
        }
    },
);
