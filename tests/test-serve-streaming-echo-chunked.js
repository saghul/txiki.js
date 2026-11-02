// A streaming response that echoes a chunked request body while the body is
// still arriving (HTTP/1.1): the rest of the body must still be read, and the
// response must carry all of it.
import assert from 'tjs:assert';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const server = tjs.serve({
    port: 0,
    listenIp: '127.0.0.1',
    fetch: req => new Response(req.body),
});

try {
    const con = await tjs.connect('tcp', '127.0.0.1', server.port);
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

    await writer.write(encoder.encode(
        'POST / HTTP/1.1\r\nHost: 127.0.0.1\r\nTransfer-Encoding: chunked\r\n\r\n3\r\nabc\r\n'));

    // The response (and its first chunk) is out before the rest of the body is sent.
    await readUntil(b => b.includes('abc'));
    assert.ok(buf.startsWith('HTTP/1.1 200'), 'echo status');

    await writer.write(encoder.encode('3\r\ndef\r\n0\r\n\r\n'));
    await readUntil(b => b.endsWith('0\r\n\r\n'));
    assert.ok(buf.includes('def'), `echo carries the late part of the body: ${JSON.stringify(buf)}`);

    con.close();
} finally {
    await server.close();
}
