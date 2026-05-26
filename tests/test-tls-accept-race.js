import assert from 'tjs:assert';
import certPem from './fixtures/server-cert.pem' with { type: 'text' };
import keyPem from './fixtures/server-key.pem' with { type: 'text' };
import caPem from './fixtures/ca.pem' with { type: 'text' };

// Race a server close against in-flight TLS handshakes. An accepted client
// that completes its TLS handshake AFTER server.close() must not surface as
// "stream is not in a state that permits enqueue" — the accept stream is
// already closed, so the result is dropped silently.

const ATTEMPTS = 50;

for (let i = 0; i < ATTEMPTS; i++) {
    const server = await tjs.listen('tls', '127.0.0.1', 0, {
        cert: certPem,
        key: keyPem,
    });

    const { readable, localPort } = await server.opened;
    const reader = readable.getReader();

    const clientPromise = tjs.connect('tls', '127.0.0.1', localPort, {
        ca: caPem,
        sni: '127.0.0.1',
        verifyPeer: false,
    });

    // Vary timing to hit the race window: sync close, microtask close, and
    // a small setTimeout close.
    if (i % 3 === 0) {
        // synchronous — closes before the TCP accept completes in most cases.
    } else if (i % 3 === 1) {
        await Promise.resolve();
    } else {
        await new Promise(resolve => setTimeout(resolve, i % 5));
    }

    server.close();

    try {
        const client = await clientPromise;

        if (client) {
            client.close();
        }
    } catch {
        // ECONNREFUSED / ECONNRESET expected for racing closes.
    }

    // Drain the accept reader. If the race ever surfaces, a stale enqueue
    // would have stopped the runtime before we got here.
    try {
        await reader.read();
    } catch {
        // ignore — server close may surface as an error or done:true.
    }

    reader.releaseLock();
}

// Single-shot variant that the original repro hit reliably on macOS: start
// the connect, do not yield, close immediately. The TCP accept fires on the
// next loop turn, the in-flight handshake completes after the controller is
// already closed.
{
    const server = await tjs.listen('tls', '127.0.0.1', 0, {
        cert: certPem,
        key: keyPem,
    });

    const { readable, localPort } = await server.opened;
    const reader = readable.getReader();

    const clientPromise = tjs.connect('tls', '127.0.0.1', localPort, {
        ca: caPem,
        sni: '127.0.0.1',
        verifyPeer: false,
    });

    server.close();

    try {
        const client = await clientPromise;

        if (client) {
            client.close();
        }
    } catch {
        // expected
    }

    const { done } = await reader.read();

    assert.eq(done, true, 'accept reader closes cleanly after server.close()');
}
