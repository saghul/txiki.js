import assert from 'tjs:assert';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function raw(port, request) {
    const con = await tjs.connect('tcp', '127.0.0.1', port);
    const { readable, writable } = await con.opened;
    const writer = writable.getWriter();

    await writer.write(encoder.encode(request));

    try {
        await writer.close();
    } catch {}

    const reader = readable.getReader();
    const chunks = [];

    while (true) {
        const read = reader.read();
        const timeout = delay(500).then(() => ({ done: true, timeout: true }));
        const { value, done, timeout: timedOut } = await Promise.race([ read, timeout ]);

        if (done || timedOut) {
            break;
        }

        chunks.push(decoder.decode(value, { stream: true }));
    }

    try {
        con.close();
    } catch {}

    return chunks.join('');
}

const bodies = [];
const server = tjs.serve({
    port: 0,
    listenIp: '127.0.0.1',
    fetch: async (req) => {
        const body = await req.text();
        bodies.push(body);
        return new Response('ok');
    },
});

/* RFC 9112 § 6.1: a request carrying both Content-Length and Transfer-Encoding
 * is ambiguous and must be rejected to prevent request smuggling. */
const both = await raw(server.port,
    'POST / HTTP/1.1\r\n' +
        'Host: 127.0.0.1\r\n' +
        'Content-Length: 5\r\n' +
        'Transfer-Encoding: chunked\r\n' +
        'Connection: close\r\n' +
        '\r\n' +
        '5\r\nhello\r\n0\r\n\r\n');

// lws rejects a CL+TE message in its own HTTP parser (emitting an HTTP/1.0
// error page) before our request callback runs, so accept either HTTP version
// in the 400 status line — what matters is that it is rejected with 400.
assert.ok(/^HTTP\/1\.[01] 400/.test(both), 'request with both CL and TE is rejected with 400');
assert.eq(bodies.length, 0, 'ambiguous request body never reaches the handler');

/* Transfer-Encoding with an unrecognized coding must also be rejected — the
 * server has no way to frame the body and accepting it would let a downstream
 * parser disagree about boundaries. */
const unknownTe = await raw(server.port,
    'POST / HTTP/1.1\r\n' +
        'Host: 127.0.0.1\r\n' +
        'Transfer-Encoding: gzip\r\n' +
        'Connection: close\r\n' +
        '\r\n');

assert.ok(unknownTe.startsWith('HTTP/1.1 400'), 'unknown transfer coding is rejected with 400');
assert.eq(bodies.length, 0, 'unknown transfer coding body never reaches the handler');

/* Confirm a Content-Length-only request still works. */
const clOnly = await raw(server.port,
    'POST / HTTP/1.1\r\n' +
        'Host: 127.0.0.1\r\n' +
        'Content-Length: 5\r\n' +
        'Connection: close\r\n' +
        '\r\n' +
        'hello');

assert.ok(clOnly.includes('HTTP/1.1 200'), 'plain Content-Length request is accepted');
assert.eq(bodies[0], 'hello', 'plain Content-Length body is delivered');

await server.close();
