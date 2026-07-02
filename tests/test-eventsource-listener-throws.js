import assert from 'tjs:assert';

const encoder = new TextEncoder();

// A throwing 'message' listener must not tear down the connection: the exception
// is reported and later messages are still delivered on the same connection, with
// no spurious reconnect (and the runtime must not abort).
let reqCount = 0;

const server = tjs.serve({
    port: 0,
    fetch: () => {
        reqCount += 1;

        return new Response(new ReadableStream({
            async start(controller) {
                controller.enqueue(encoder.encode('data: a\n\n'));
                await new Promise(r => setTimeout(r, 20));
                controller.enqueue(encoder.encode('data: b\n\n'));
                await new Promise(r => setTimeout(r, 20));
                controller.enqueue(encoder.encode('data: c\n\n'));
                // Keep the stream open; the test closes the EventSource.
            },
        }), { headers: { 'content-type': 'text/event-stream' } });
    },
});

const es = new EventSource(`http://127.0.0.1:${server.port}/`);
const got = [];
const done = Promise.withResolvers();
let threw = false;

es.onmessage = e => {
    got.push(e.data);

    if (e.data === 'a') {
        threw = true;
        throw new Error('boom from listener');
    }

    if (e.data === 'c') {
        done.resolve();
    }
};

await done.promise;

assert.ok(threw, 'listener threw on the first message');
assert.eq(got, [ 'a', 'b', 'c' ], 'connection survived the throwing listener; later messages delivered');
assert.eq(reqCount, 1, 'no spurious reconnect after a throwing listener');
assert.eq(es.readyState, EventSource.OPEN, 'still OPEN');

es.close();
await server.close();
