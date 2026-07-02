import assert from 'tjs:assert';

const encoder = new TextEncoder();

let reqCount = 0;

const server = tjs.serve({
    port: 0,
    fetch: () => {
        reqCount += 1;

        if (reqCount === 1) {
            // Honor a small retry, then end the stream to force a reconnect.
            return new Response(new ReadableStream({
                start(controller) {
                    controller.enqueue(encoder.encode('retry: 60\ndata: one\n\n'));
                    controller.close();
                },
            }), { headers: { 'content-type': 'text/event-stream' } });
        }

        return new Response(new ReadableStream({
            start(controller) {
                controller.enqueue(encoder.encode('data: two\n\n'));
            },
        }), { headers: { 'content-type': 'text/event-stream' } });
    },
});

const es = new EventSource(`http://127.0.0.1:${server.port}/`);
const gotOne = Promise.withResolvers();
const gotTwo = Promise.withResolvers();
let errorReadyState = null;

es.onmessage = e => {
    if (e.data === 'one') {
        gotOne.resolve();
    } else if (e.data === 'two') {
        gotTwo.resolve();
    }
};
es.onerror = () => {
    // The error event that precedes a reconnect fires while CONNECTING.
    if (errorReadyState === null) {
        errorReadyState = es.readyState;
    }
};

await gotOne.promise;
await gotTwo.promise;

assert.eq(errorReadyState, EventSource.CONNECTING, 'error before reconnect fires while CONNECTING');
assert.ok(reqCount >= 2, 'the client reconnected after the stream ended');

es.close();
await server.close();
