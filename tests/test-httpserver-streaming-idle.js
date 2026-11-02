// A streaming response that goes idle (no data for longer than lws's 15 s
// pending timeout) stays open until the stream sends more data and closes:
// tjs.serve puts no idle limit on streaming responses (SSE, long-poll). The
// server sends 'a', idles 20 s, then sends 'b' and closes. The cases run
// concurrently so the file stays well under the test runner's timeout.
//
// HTTP/1.1 only: over h2 the fetch() client cuts an idle response body on its
// own, so an h2 case would test the client, not the server.
import assert from 'tjs:assert';

// Skipped under GC stress: it starves the event loop, so the 20 s idle plus
// the requests no longer fit in the test timeout.
if (tjs.env.TJS_GC_STRESS) {
    tjs.exit(0);
}

const IDLE_MS = 20000;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function handler(req) {
    if (new URL(req.url).pathname !== '/idle') {
        return new Response('ok');
    }

    return new Response(new ReadableStream({
        async start(controller) {
            controller.enqueue(encoder.encode('a'));
            await new Promise(resolve => setTimeout(resolve, IDLE_MS));
            controller.enqueue(encoder.encode('b'));
            controller.close();
        },
    }));
}

// Raw HTTP/1.1 client, to check the wire framing: the full chunked body with
// its terminator arrives, and the connection is still usable afterwards.
async function testH1Raw(port) {
    const con = await tjs.connect('tcp', '127.0.0.1', port);
    const { readable, writable } = await con.opened;
    const writer = writable.getWriter();
    const reader = readable.getReader();
    let buf = '';

    async function readUntil(pred) {
        while (!pred(buf)) {
            const { value, done } = await reader.read();

            if (done) {
                throw new Error(`connection closed early, got ${JSON.stringify(buf)}`);
            }

            buf += decoder.decode(value, { stream: true });
        }
    }

    await writer.write(encoder.encode('GET /idle HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n'));
    await readUntil(b => b.includes('0\r\n\r\n'));
    assert.ok(buf.startsWith('HTTP/1.1 200'), 'h1 idle stream status');
    assert.ok(buf.endsWith('1\r\na\r\n1\r\nb\r\n0\r\n\r\n'), `h1 idle stream full body: ${JSON.stringify(buf)}`);

    buf = '';
    await writer.write(encoder.encode('GET /after HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n'));
    await readUntil(b => b.endsWith('ok'));
    assert.ok(buf.startsWith('HTTP/1.1 200'), 'kept-alive connection serves the next request');

    con.close();
}

async function testFetch(url) {
    const resp = await fetch(url);

    assert.eq(resp.status, 200, `${url} status`);
    assert.eq(await resp.text(), 'ab', `${url} full body`);
}

const server = tjs.serve({ port: 0, listenIp: '127.0.0.1', fetch: handler });

try {
    await Promise.all([
        testH1Raw(server.port),
        testFetch(`http://127.0.0.1:${server.port}/idle`),
    ]);
} finally {
    await server.close();
}
