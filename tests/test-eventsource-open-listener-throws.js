import assert from 'tjs:assert';

const encoder = new TextEncoder();

// A throwing 'open' listener must not abort the runtime or leave the response body
// unread: the connection proceeds and messages are still delivered.
let reqCount = 0;

const server = tjs.serve({
    port: 0,
    fetch: () => {
        reqCount += 1;

        return new Response(new ReadableStream({
            async start(controller) {
                await new Promise(r => setTimeout(r, 20));
                controller.enqueue(encoder.encode('data: hi\n\n'));
                // Keep the stream open; the test closes the EventSource.
            },
        }), { headers: { 'content-type': 'text/event-stream' } });
    },
});

const es = new EventSource(`http://127.0.0.1:${server.port}/`);
const gotMessage = Promise.withResolvers();
let threw = false;

es.onopen = () => {
    threw = true;
    throw new Error('boom from open listener');
};
es.onmessage = e => gotMessage.resolve(e.data);

assert.eq(await gotMessage.promise, 'hi', 'connection proceeds past a throwing open listener; body is read');
assert.ok(threw, 'open listener threw');
assert.eq(reqCount, 1, 'no spurious reconnect');

es.close();
await server.close();
