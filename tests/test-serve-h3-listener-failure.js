import assert from 'tjs:assert';
import cert from './fixtures/server-cert.pem' with { type: 'text' };
import key from './fixtures/server-key.pem' with { type: 'text' };

// A failed HTTP/3 (QUIC) listener must leave a collectable server behind: the
// vhosts torn down on that path do not all report back to us, so the server's
// self-pin has to be released at runtime teardown. Otherwise the wrapper
// survives JS_FreeRuntime, which a debug build catches with an assert.

// Squat on a UDP port so binding the QUIC listener on it cannot succeed.
const squatter = await tjs.listen('udp', '127.0.0.1', 0);
const port = (await squatter.opened).localPort;

let error;

try {
    tjs.serve({
        port,
        listenIp: '127.0.0.1',
        tls: { cert, key },
        http3: true,
        fetch: () => new Response('nope'),
    });
} catch (e) {
    error = e;
}

assert.ok(error instanceof Error, 'serve() rejects a QUIC listener it cannot bind');
assert.ok(error.message.includes('failed to create HTTP/3 (QUIC) listener'), error.message);
assert.ok(error.message.includes(`127.0.0.1:${port}/udp`), `error names the UDP address: ${error.message}`);

squatter.close();
