import assert from 'tjs:assert';
import cert from './fixtures/server-cert.pem' with { type: 'text' };
import key from './fixtures/server-key.pem' with { type: 'text' };

// Two HTTP/3 servers closed together must both close. Their QUIC vhosts used
// to look alike to lws, so destroying one moved its UDP socket onto the other
// while freeing lists the socket was still on (heap-use-after-free).

const mk = () =>
    tjs.serve({
        port: 0,
        listenIp: '127.0.0.1',
        tls: { cert, key },
        http3: true,
        fetch: () => new Response('x'),
    });

const a = mk();
const b = mk();
let closed = false;

// Without ASAN the broken close left the loop empty and the process exited
// with the promise still pending, which would otherwise look like a pass.
addEventListener('beforeunload', () => {
    if (!closed) {
        console.error('close() promises never settled');
        tjs.exit(1);
    }
});

await Promise.all([ a.close(), b.close() ]);
closed = true;

assert.ok(closed, 'both servers closed');
