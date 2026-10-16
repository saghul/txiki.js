import assert from 'tjs:assert';
import cert from './fixtures/server-cert.pem' with { type: 'text' };
import key from './fixtures/server-key.pem' with { type: 'text' };

// Two HTTP/3 servers closed one after the other must both close. Their QUIC
// vhosts used to look alike to lws, so closing the first handed its UDP
// socket to the second and the first close() never resolved.

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
let aClosed = false;
let bClosed = false;

addEventListener('beforeunload', () => {
    if (!aClosed || !bClosed) {
        console.error('close() promises never settled');
        tjs.exit(1);
    }
});

const aPort = a.port;

await a.close();
aClosed = true;

// a's UDP socket must really be closed, not handed over to b's vhost.
const udp = await tjs.listen('udp', '127.0.0.1', aPort);
assert.eq((await udp.opened).localPort, aPort, 'first server UDP port is free again');
udp.close();

await b.close();
bClosed = true;

assert.ok(aClosed, 'first server closed');
assert.ok(bClosed, 'second server closed');
