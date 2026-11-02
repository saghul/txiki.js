import assert from 'tjs:assert';
import cert from './fixtures/server-cert.pem' with { type: 'text' };
import key from './fixtures/server-key.pem' with { type: 'text' };

// A failed HTTP/3 (QUIC) listener must leave a collectable server behind: the
// vhosts torn down on that path do not all report back to us, so the server's
// self-pin has to be released at runtime teardown. Otherwise the wrapper
// survives JS_FreeRuntime, which a debug build catches with an assert.

// Squat on a UDP port so binding the QUIC listener on it cannot succeed. The TCP
// vhost binds the same port first and a free UDP port says nothing about TCP, so
// retry with a fresh port when the TCP side is already taken. Pick random ports
// from the dynamic range rather than port 0: on Windows port 0 hands out nearby
// ports, which keep landing in the same TCP excluded port range.
const kMaxAttempts = 20;
const kDynamicPortMin = 49152;
const kDynamicPortMax = 65535;
const attempts = [];
let squatter, port, error;

for (let attempt = 0; attempt < kMaxAttempts; attempt++) {
    squatter?.close();
    squatter = undefined;
    port = kDynamicPortMin + Math.floor(Math.random() * (kDynamicPortMax - kDynamicPortMin + 1));
    error = undefined;

    try {
        squatter = await tjs.listen('udp', '127.0.0.1', port);
    } catch (e) {
        attempts.push(`${port} (udp: ${e.message})`);
        continue;
    }

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

    attempts.push(`${port} (serve: ${error?.message ?? 'no error'})`);

    if (!(error instanceof Error) || !error.message.startsWith('failed to create HTTP server vhost')) {
        break;
    }
}

squatter?.close();

assert.ok(error instanceof Error, 'serve() rejects a QUIC listener it cannot bind');
assert.ok(
    error.message.startsWith('failed to create HTTP/3 (QUIC) listener'),
    `unexpected error after ${attempts.length} attempts (ports ${attempts.join(', ')}): ${error.message}`,
);
assert.ok(error.message.includes(`on port ${port}`), `error names port ${port}: ${error.message}`);
