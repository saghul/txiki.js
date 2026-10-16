import assert from 'tjs:assert';
import cert from './fixtures/server-cert.pem' with { type: 'text' };
import key from './fixtures/server-key.pem' with { type: 'text' };

// Creating a new HTTP/3 server right after `await server.close()` must not run
// inside libwebsockets' teardown of the previous server's vhosts. If close()
// resolved from there, the next serve() would create vhosts re-entrantly and
// lws would later touch freed memory. The cycles are back-to-back on purpose:
// that is the trigger. Release builds tend to segfault; the ASAN
// (RelWithDebInfo) CI jobs report the use-after-free reliably.

for (let i = 0; i < 10; i++) {
    const server = tjs.serve({
        port: 0,
        listenIp: '127.0.0.1',
        tls: { cert, key },
        http3: true,
        fetch: () => new Response('ok'),
    });

    assert.ok(server.port > 0, `cycle ${i}: server is listening`);

    await server.close();
}
