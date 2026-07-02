import assert from 'tjs:assert';

const enc = new TextEncoder();

// Each chunk is delivered as a separate network read (small delays between them)
// to exercise cross-chunk buffering: a line split mid-field, a \r\n terminator
// split across the boundary, and a multi-byte UTF-8 character (é = 0xC3 0xA9)
// split across the boundary.
const chunks = [
    enc.encode('data: hel'),
    enc.encode('lo\n\n'),                                    // -> "hello"
    new Uint8Array([ ...enc.encode('data: caf'), 0xC3 ]),
    new Uint8Array([ 0xA9, ...enc.encode('\n\n') ]),         // -> "café"
    enc.encode('data: crlf\r'),
    enc.encode('\n\r\n'),                                    // -> "crlf"
    enc.encode('data: __END__\n\n'),
];

const server = tjs.serve({
    port: 0,
    fetch: () => new Response(new ReadableStream({
        async start(controller) {
            for (const chunk of chunks) {
                controller.enqueue(chunk);
                await new Promise(r => setTimeout(r, 15));
            }
        },
    }), { headers: { 'content-type': 'text/event-stream' } }),
});

const es = new EventSource(`http://127.0.0.1:${server.port}/`);
const done = Promise.withResolvers();
const msgs = [];

es.onmessage = e => {
    if (e.data === '__END__') {
        done.resolve();

        return;
    }

    msgs.push(e.data);
};

await done.promise;

assert.eq(msgs.length, 3, 'three messages reassembled across chunk boundaries');
assert.eq(msgs[0], 'hello', 'line split mid-field is reassembled');
assert.eq(msgs[1], 'café', 'multi-byte UTF-8 char split across chunks is decoded');
assert.eq(msgs[2], 'crlf', '\\r\\n terminator split across chunks is handled');

es.close();
await server.close();
