import assert from 'tjs:assert';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Read until we've collected one complete Content-Length-delimited HTTP/1.1
// response on the wire, returning that response and any leftover bytes that
// belong to the next response.
async function readContentLengthResponse(reader, initial) {
    let buf = initial;

    while (true) {
        const idx = buf.indexOf('\r\n\r\n');

        if (idx >= 0) {
            const head = buf.slice(0, idx);
            const m = head.match(/\r\nContent-Length:\s*(\d+)/i);

            if (!m) {
                throw new Error(`missing Content-Length in response: ${head}`);
            }

            const bodyLen = parseInt(m[1], 10);
            const total = idx + 4 + bodyLen;

            if (buf.length >= total) {
                return { response: buf.slice(0, total), rest: buf.slice(total) };
            }
        }

        const read = reader.read();
        const timeout = delay(2000).then(() => ({ done: true, timeout: true }));
        const { value, done, timeout: timedOut } = await Promise.race([ read, timeout ]);

        if (timedOut) {
            throw new Error(`timed out (have ${buf.length} bytes)`);
        }

        if (done) {
            throw new Error(`connection closed mid-response (have ${buf.length} bytes)`);
        }

        buf += decoder.decode(value, { stream: true });
    }
}

// Buffered responses on a single keep-alive connection.  Regression test
// for https://github.com/saghul/txiki.js/issues/924 — non-streaming
// responses were retaining their response_data buffer for the entire
// connection lifetime instead of being freed once the response completed.
async function testBufferedKeepAlive() {
    let count = 0;
    const server = tjs.serve({
        port: 0,
        listenIp: '127.0.0.1',
        fetch: () => {
            count++;
            // Use a non-trivial body so a reintroduction of the leak would
            // be obvious to a heap profiler — every request would otherwise
            // retain 64 KiB until the connection closed.
            const body = new Uint8Array(64 * 1024).fill(0x41 + (count % 26));

            return new Response(body, { headers: { 'content-type': 'application/octet-stream' } });
        },
    });

    const con = await tjs.connect('tcp', '127.0.0.1', server.port);
    const { readable, writable } = await con.opened;
    const writer = writable.getWriter();
    const reader = readable.getReader();

    const N = 20;
    let leftover = '';

    for (let i = 0; i < N; i++) {
        const last = i === N - 1;
        const req = `GET /${i} HTTP/1.1\r\nHost: 127.0.0.1\r\n` +
            (last ? 'Connection: close\r\n' : '') + '\r\n';

        await writer.write(encoder.encode(req));

        const { response, rest } = await readContentLengthResponse(reader, leftover);

        leftover = rest;

        assert.ok(response.startsWith('HTTP/1.1 200'), `request ${i} got 200`);
        assert.ok(/\r\nContent-Length:\s*65536\r\n/i.test(response),
            `request ${i} has 64 KiB body`);
    }

    assert.eq(count, N, `server handled ${N} requests`);

    try {
        await writer.close();
    } catch {}

    try {
        con.close();
    } catch {}

    server.close();
}

// Empty-body buffered responses on a keep-alive connection.  The no-body
// code path in sendResponse is separate from the body path and also needs
// to release the request promptly.
async function testEmptyBodyKeepAlive() {
    let count = 0;
    const server = tjs.serve({
        port: 0,
        listenIp: '127.0.0.1',
        fetch: () => {
            count++;

            return new Response(null, { status: 204 });
        },
    });

    const con = await tjs.connect('tcp', '127.0.0.1', server.port);
    const { readable, writable } = await con.opened;
    const writer = writable.getWriter();
    const reader = readable.getReader();

    const N = 10;
    let buf = '';

    for (let i = 0; i < N; i++) {
        const last = i === N - 1;
        const req = `GET /${i} HTTP/1.1\r\nHost: 127.0.0.1\r\n` +
            (last ? 'Connection: close\r\n' : '') + '\r\n';

        await writer.write(encoder.encode(req));

        // 204 responses must have no body; just read until headers terminate.
        while (true) {
            const idx = buf.indexOf('\r\n\r\n');

            if (idx >= 0) {
                const head = buf.slice(0, idx);

                assert.ok(head.startsWith('HTTP/1.1 204'), `request ${i} got 204`);
                buf = buf.slice(idx + 4);
                break;
            }

            const read = reader.read();
            const timeout = delay(2000).then(() => ({ done: true, timeout: true }));
            const { value, done, timeout: timedOut } = await Promise.race([ read, timeout ]);

            if (timedOut) {
                throw new Error(`request ${i}: timed out`);
            }

            if (done) {
                throw new Error(`request ${i}: connection closed`);
            }

            buf += decoder.decode(value, { stream: true });
        }
    }

    assert.eq(count, N, `server handled ${N} requests`);

    try {
        await writer.close();
    } catch {}

    try {
        con.close();
    } catch {}

    server.close();
}

await testBufferedKeepAlive();
await testEmptyBodyKeepAlive();
