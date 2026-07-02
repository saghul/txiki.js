import assert from 'tjs:assert';

const encoder = new TextEncoder();

let reqCount = 0;
let secondReqLastEventId = null;

const server = tjs.serve({
    port: 0,
    fetch: req => {
        reqCount += 1;

        if (reqCount === 1) {
            // Set an id and a short retry, then end the stream so the client
            // reconnects quickly.
            return new Response(new ReadableStream({
                start(controller) {
                    controller.enqueue(encoder.encode('retry: 50\nid: abc\ndata: first\n\n'));
                    controller.close();
                },
            }), { headers: { 'content-type': 'text/event-stream' } });
        }

        secondReqLastEventId = req.headers.get('last-event-id');

        return new Response(new ReadableStream({
            start(controller) {
                controller.enqueue(encoder.encode('data: second\n\n'));
            },
        }), { headers: { 'content-type': 'text/event-stream' } });
    },
});

const es = new EventSource(`http://127.0.0.1:${server.port}/`);
const gotFirst = Promise.withResolvers();
const gotSecond = Promise.withResolvers();

es.onmessage = e => {
    if (e.data === 'first') {
        gotFirst.resolve(e);
    } else if (e.data === 'second') {
        gotSecond.resolve(e);
    }
};

const first = await gotFirst.promise;
assert.eq(first.lastEventId, 'abc', 'lastEventId set from the id field');

const second = await gotSecond.promise;
assert.eq(second.lastEventId, 'abc', 'lastEventId persists across reconnection');
assert.eq(secondReqLastEventId, 'abc', 'reconnect request carries the Last-Event-ID header');

es.close();
await server.close();
