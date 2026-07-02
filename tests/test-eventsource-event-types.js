import assert from 'tjs:assert';

const encoder = new TextEncoder();

// An "event:" field routes the message to addEventListener(type); the event type
// buffer must reset to the default "message" for the next block.
const body =
    'event: custom\n' +
    'data: a\n' +
    '\n' +
    'data: b\n' +
    '\n';

const server = tjs.serve({
    port: 0,
    fetch: () => new Response(new ReadableStream({
        start(controller) {
            controller.enqueue(encoder.encode(body));
        },
    }), { headers: { 'content-type': 'text/event-stream' } }),
});

const es = new EventSource(`http://127.0.0.1:${server.port}/`);
const gotCustom = Promise.withResolvers();
const gotMessage = Promise.withResolvers();

es.addEventListener('custom', e => {
    assert.ok(e instanceof MessageEvent, 'custom event is a MessageEvent');
    gotCustom.resolve(e.data);
});
es.onmessage = e => gotMessage.resolve(e.data);

assert.eq(await gotCustom.promise, 'a', 'named event dispatched to its type listener');
assert.eq(await gotMessage.promise, 'b', 'event type resets to "message" after dispatch');

es.close();
await server.close();
