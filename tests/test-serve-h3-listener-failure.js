import assert from 'tjs:assert';
import cert from './fixtures/server-cert.pem' with { type: 'text' };
import key from './fixtures/server-key.pem' with { type: 'text' };

// A failed HTTP/3 (QUIC) listener must leave a collectable server behind: the
// vhosts torn down on that path do not all report back to us, so the server's
// self-pin has to be released at runtime teardown. Otherwise the wrapper
// survives JS_FreeRuntime, which a debug build catches with an assert.

// Squat on a UDP port so binding the QUIC listener on it cannot succeed. The TCP
// vhost binds the same port first and a free UDP port says nothing about TCP, so
// retry with a fresh port when the TCP side is already taken.
let squatter, port, error;

for (let attempt = 0; attempt < 10; attempt++) {
    squatter = await tjs.listen('udp', '127.0.0.1', 0);
    port = (await squatter.opened).localPort;
    error = undefined;

    // An explicit port never falls back to another one: serve() must throw, and
    // the error names the port it tried.
    try {
        const server = tjs.serve({
            port,
            listenIp: '127.0.0.1',
            tls: { cert, key },
            http3: true,
            fetch: () => new Response('nope'),
        });

        server.close();
    } catch (e) {
        error = e;
    }

    if (!(error instanceof Error) || !error.message.startsWith('failed to create HTTP server vhost')) {
        break;
    }

    squatter.close();
}

assert.ok(error instanceof Error, 'serve() rejects a QUIC listener it cannot bind');
assert.ok(error.message.startsWith('failed to create HTTP/3 (QUIC) listener'), `unexpected error: ${error.message}`);
assert.ok(error.message.includes(`on port ${port}`), `error names port ${port}: ${error.message}`);

squatter.close();
