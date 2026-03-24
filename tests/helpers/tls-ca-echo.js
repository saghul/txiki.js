import assert from 'tjs:assert';
import cert from '../fixtures/server-cert.pem' with { type: 'text' };
import key from '../fixtures/server-key.pem' with { type: 'text' };

const server = tjs.serve({
    port: 0,
    tls: { cert, key },
    fetch: async (req) => {
        const body = await req.text();

        return new Response(`echo: ${body}`);
    },
});

try {
    const resp = await fetch(`https://127.0.0.1:${server.port}/`, {
        method: 'POST',
        body: 'hello',
    });

    assert.eq(resp.status, 200, 'echo response status');

    const text = await resp.text();

    assert.eq(text, 'echo: hello', 'echo response body');
} finally {
    server.close();
}
