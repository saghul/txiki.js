import assert from 'tjs:assert';
import cert from './fixtures/server-cert.pem' with { type: 'text' };
import key from './fixtures/server-key.pem' with { type: 'text' };

// tjs.serve({ port: 0, http3: true }) must find a port that works for both the
// TCP and the UDP (QUIC) listener on its own. Keeping many servers open at once
// walks the OS ephemeral port allocator across a range of ports.

const N = 32;
const servers = [];

try {
    for (let i = 0; i < N; i++) {
        servers.push(tjs.serve({
            port: 0,
            listenIp: '127.0.0.1',
            tls: { cert, key },
            http3: true,
            fetch: () => new Response('ok'),
        }));
    }

    const ports = servers.map(s => s.port);

    for (const port of ports) {
        assert.ok(port > 0, `server got a real port: ${port}`);
    }

    assert.eq(new Set(ports).size, N, 'every server got its own port');
} finally {
    await Promise.all(servers.map(s => s.close()));
}
