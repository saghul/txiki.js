import assert from 'tjs:assert';
import cert from '../fixtures/server-cert.pem' with { type: 'text' };
import key from '../fixtures/server-key.pem' with { type: 'text' };

// Same HTTPS echo as tls-ca-echo.js, but the fetch runs inside a Worker, so it
// only trusts the server if the worker inherited the CA bundle.

const server = tjs.serve({
    port: 0,
    tls: { cert, key },
    fetch: async (req) => {
        const body = await req.text();

        return new Response(`echo: ${body}`);
    },
});

const src = `
fetch('https://127.0.0.1:${server.port}/', { method: 'POST', body: 'hello' })
    .then(async r => self.postMessage({ status: r.status, text: await r.text() }))
    .catch(e => self.postMessage({ error: String(e) }));
`;
const w = new Worker(URL.createObjectURL(new Blob([ src ], { type: 'text/javascript' })));

try {
    const result = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timed out waiting for worker')), 30000);

        w.onmessage = e => {
            clearTimeout(timer);
            resolve(e.data);
        };
        w.onerror = e => {
            clearTimeout(timer);
            reject(new Error(e.message));
        };
    });

    assert.ok(!result.error, `worker fetch failed: ${result.error}`);
    assert.eq(result.status, 200, 'echo response status');
    assert.eq(result.text, 'echo: hello', 'echo response body');
} finally {
    w.terminate();
    await server.close();
}
