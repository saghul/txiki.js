import assert from 'tjs:assert';

const encoder = new TextEncoder();

// A connection that drops mid-event (an id: was parsed but the event was never
// dispatched because no blank line arrived) must resume from the last *dispatched*
// event's id, per the spec's separation of the "last event ID buffer" (set on
// parse) from the "last event ID string" (committed only at dispatch).
let reqCount = 0;
let secondReqLastEventId = null;

const server = tjs.serve({
    port: 0,
    fetch: req => {
        reqCount += 1;

        if (reqCount === 1) {
            return new Response(new ReadableStream({
                start(controller) {
                    // Event 1 dispatches and commits the last-event-ID string to "1".
                    controller.enqueue(encoder.encode('retry: 50\nid: 1\ndata: msg1\n\n'));
                    // Event 2 sets id "2" but the stream drops before the blank line,
                    // so it is never dispatched.
                    controller.enqueue(encoder.encode('id: 2\ndata: msg2\n'));
                    controller.close();
                },
            }), { headers: { 'content-type': 'text/event-stream' } });
        }

        secondReqLastEventId = req.headers.get('last-event-id');

        return new Response(new ReadableStream({
            start(controller) {
                controller.enqueue(encoder.encode('data: done\n\n'));
            },
        }), { headers: { 'content-type': 'text/event-stream' } });
    },
});

const es = new EventSource(`http://127.0.0.1:${server.port}/`);
const gotMsg1 = Promise.withResolvers();
const gotDone = Promise.withResolvers();

es.onmessage = e => {
    if (e.data === 'msg1') {
        gotMsg1.resolve(e);
    } else if (e.data === 'done') {
        gotDone.resolve(e);
    }
};

const m1 = await gotMsg1.promise;
assert.eq(m1.lastEventId, '1', 'first event carries the committed id "1"');

await gotDone.promise;
assert.eq(secondReqLastEventId, '1', 'reconnect resumes from the last dispatched id ("1"), not the mid-event id ("2")');

es.close();
await server.close();
