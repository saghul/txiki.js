// An h2 server closed right after a batch of fetches in which one sent
// "Connection: close" (and so had its own connection) must finish closing.
// The client's last frames on that connection used to reach the server after
// close() had decided the connection was to go, and re-armed its timeout, so
// the connection and the server were never torn down and close() never
// settled: the process just ran out of work and exited.
import assert from 'tjs:assert';
import cert from './fixtures/server-cert.pem' with { type: 'text' };
import key from './fixtures/server-key.pem' with { type: 'text' };

let closed = false;

addEventListener('beforeunload', () => {
    if (!closed) {
        console.error('server.close() never settled');
        tjs.exit(1);
    }
});

const server = tjs.serve({
    port: 0,
    listenIp: '127.0.0.1',
    tls: { cert, key, alpn: [ 'h2' ] },
    fetch: async () => {
        await new Promise(resolve => setTimeout(resolve, 100));

        return new Response('ok');
    },
});
const url = `https://127.0.0.1:${server.port}/`;

await (await fetch(url, { allowInsecure: true })).text();

const results = await Promise.all([ 0, 1, 2, 3 ].map(async i => {
    const r = await fetch(url, { allowInsecure: true, headers: i === 1 ? { connection: 'close' } : {} });

    return `${r.status} ${await r.text()}`;
}));

assert.eq(results.join(','), '200 ok,200 ok,200 ok,200 ok', 'concurrent fetches');

await server.close();
closed = true;
