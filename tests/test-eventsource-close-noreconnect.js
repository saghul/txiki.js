import assert from 'tjs:assert';

const encoder = new TextEncoder();

let reqCount = 0;

// The stream ends after one event with a long retry, so the client schedules a
// reconnect timer. Calling close() during that wait must cancel the timer: no
// second request is made and, since the timer was the only thing keeping the
// loop alive, the process exits promptly (it would otherwise hang for ~30s).
const server = tjs.serve({
    port: 0,
    fetch: () => {
        reqCount += 1;

        return new Response(new ReadableStream({
            start(controller) {
                controller.enqueue(encoder.encode('retry: 30000\ndata: x\n\n'));
                controller.close();
            },
        }), { headers: { 'content-type': 'text/event-stream' } });
    },
});

const es = new EventSource(`http://127.0.0.1:${server.port}/`);
const closedDuringWait = Promise.withResolvers();

es.onerror = () => {
    // Fires when the reconnect is scheduled (readyState CONNECTING).
    assert.eq(es.readyState, EventSource.CONNECTING, 'reconnect pending while CONNECTING');
    es.close();
    assert.eq(es.readyState, EventSource.CLOSED, 'close() during the wait sets CLOSED');
    closedDuringWait.resolve();
};

await closedDuringWait.promise;

// Well under the 30s retry: if the timer were still pending it would reconnect.
await new Promise(r => setTimeout(r, 200));
assert.eq(reqCount, 1, 'no reconnect after close() cancelled the timer');

await server.close();
