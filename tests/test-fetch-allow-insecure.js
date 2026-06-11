import assert from 'tjs:assert';
import certPem from './fixtures/server-cert.pem' with { type: 'text' };
import keyPem from './fixtures/server-key.pem' with { type: 'text' };

// Each request gets a fresh server: a rejected TLS handshake and a completed
// one are independent connections, and reusing one server would couple them.
async function withServer(fn) {
    const server = tjs.serve({
        port: 0,
        listenIp: '127.0.0.1',
        tls: { cert: certPem, key: keyPem },
        fetch: () => new Response('insecure ok'),
    });

    try {
        return await fn(server.port);
    } finally {
        await server.close();
    }
}

// Without allowInsecure the self-signed certificate must fail verification.
const rejected = await withServer(async port => {
    try {
        await fetch(`https://127.0.0.1:${port}/`);

        return { ok: true };
    } catch (e) {
        return { ok: false, error: String(e) };
    }
});

assert.ok(!rejected.ok, 'fetch rejects a self-signed certificate by default');

// With allowInsecure the same request succeeds.
const allowed = await withServer(async port => {
    const resp = await fetch(`https://127.0.0.1:${port}/`, { allowInsecure: true });

    return { ok: true, status: resp.status, body: await resp.text() };
});

assert.ok(allowed.ok, `fetch succeeds with allowInsecure: ${allowed.error ?? ''}`);
assert.eq(allowed.status, 200, 'status is 200 with allowInsecure');
assert.eq(allowed.body, 'insecure ok', 'body received over the insecure connection');
