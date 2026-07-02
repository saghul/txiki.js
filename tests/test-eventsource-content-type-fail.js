import assert from 'tjs:assert';

const encoder = new TextEncoder();

// A 200 response whose content type is not "text/event-stream" must fail the
// connection permanently: readyState becomes CLOSED and no reconnect happens.
let reqCount = 0;

const server = tjs.serve({
    port: 0,
    fetch: () => {
        reqCount += 1;

        return new Response(encoder.encode('<html></html>'), { status: 200, headers: { 'content-type': 'text/html' } });
    },
});

const es = new EventSource(`http://127.0.0.1:${server.port}/`);
const errored = Promise.withResolvers();

es.onerror = () => errored.resolve(es.readyState);

const readyStateAtError = await errored.promise;
assert.eq(readyStateAtError, EventSource.CLOSED, 'readyState is CLOSED on a wrong content type');

// Give any (erroneous) reconnect time to fire; there must be none.
await new Promise(r => setTimeout(r, 200));
assert.eq(reqCount, 1, 'no reconnect after a permanent failure');
assert.eq(es.readyState, EventSource.CLOSED, 'stays CLOSED');

es.close();
await server.close();
