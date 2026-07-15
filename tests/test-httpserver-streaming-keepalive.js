// A streaming response (ReadableStream body, unknown length) is framed with
// Transfer-Encoding: chunked over HTTP/1.1 and keeps the connection alive, so
// the client can reuse it for the next request. (Previously such responses were
// close-delimited with Connection: close, which forced a new connection — and
// broke pipelining.) We drive a raw TCP client so we can see the wire framing
// and prove multiple requests ride a single connection.
import assert from 'tjs:assert';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Read one complete chunked HTTP/1.1 response (headers + chunked body up to the
// "0\r\n\r\n" terminator), returning it and any leftover bytes for the next one.
async function readChunkedResponse(reader, initial) {
    let buf = initial;

    while (true) {
        const headEnd = buf.indexOf('\r\n\r\n');

        if (headEnd >= 0) {
            const head = buf.slice(0, headEnd);

            assert.ok(/\r\ntransfer-encoding:\s*chunked/i.test(head),
                `streamed response is chunked, not close-delimited:\n${head}`);
            assert.ok(!/\r\nconnection:\s*close/i.test(head),
                `streamed response keeps the connection alive:\n${head}`);

            const term = buf.indexOf('0\r\n\r\n', headEnd + 4);

            if (term >= 0) {
                const total = term + 5;

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

let count = 0;

const server = tjs.serve({
    port: 0,
    listenIp: '127.0.0.1',
    fetch: req => {
        count++;

        const path = new URL(req.url).pathname;

        return new Response(new ReadableStream({
            start(controller) {
                controller.enqueue(encoder.encode(`stream:${path}:`));
                controller.enqueue(encoder.encode('done'));
                controller.close();
            },
        }));
    },
});

const con = await tjs.connect('tcp', '127.0.0.1', server.port);
const { readable, writable } = await con.opened;
const writer = writable.getWriter();
const reader = readable.getReader();

const N = 4;
let leftover = '';

for (let i = 0; i < N; i++) {
    const last = i === N - 1;
    const req = `GET /r${i} HTTP/1.1\r\nHost: 127.0.0.1\r\n` +
        (last ? 'Connection: close\r\n' : '') + '\r\n';

    await writer.write(encoder.encode(req));

    const { response, rest } = await readChunkedResponse(reader, leftover);

    leftover = rest;

    assert.ok(response.startsWith('HTTP/1.1 200'), `request ${i} got 200`);
    // Body arrives in two chunks ("stream:/rN:" then "done"), so the two parts
    // are present in the framed response but not adjacent.
    assert.ok(response.includes(`stream:/r${i}:`), `request ${i} body part 1`);
    assert.ok(response.includes('done'), `request ${i} body part 2`);
}

assert.eq(count, N, `all ${N} streamed requests rode one kept-alive connection`);

try {
    await writer.close();
} catch {}

try {
    con.close();
} catch {}

await server.close();
