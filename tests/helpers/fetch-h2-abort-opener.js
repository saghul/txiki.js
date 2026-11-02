import cert from '../fixtures/server-cert.pem' with { type: 'text' };
import key from '../fixtures/server-key.pem' with { type: 'text' };

// Short delays hit the opener while its h2/TLS connection is still connecting
// or negotiating ALPN; the sibling queues behind it as the pooled leader.
for (let d = 0; d <= 12; d++) {
    const server = tjs.serve({
        port: 0,
        listenIp: '127.0.0.1',
        tls: { cert, key, alpn: [ 'h2' ] },
        fetch: async () => {
            await new Promise(r => setTimeout(r, 100));

            return new Response('x'.repeat(4096));
        },
    });
    const url = `https://127.0.0.1:${server.port}/`;
    const ac = new AbortController();
    const opener = fetch(url, { allowInsecure: true, signal: ac.signal }).then(() => 'ok', e => e.name);
    const sibling = new Promise(r => setTimeout(r, Math.max(0, d - 1)))
        .then(() => fetch(url, { allowInsecure: true }))
        .then(r => r.text())
        .then(t => `sibling ok ${t.length}`, e => `sibling ${e.name}`);

    setTimeout(() => ac.abort(), d);
    console.log(d, await opener, await sibling);
    await server.close();
}

console.log('loop done');
