import assert from 'tjs:assert';

const encoder = new TextEncoder();

// A relative URL cannot be resolved without a base and must throw a SyntaxError.
assert.throws(() => new EventSource('/relative/path'), DOMException, 'relative URL throws');

const server = tjs.serve({
    port: 0,
    fetch: () => new Response(new ReadableStream({
        start(controller) {
            controller.enqueue(encoder.encode('data: hello\n\n'));
            // Keep the stream open so the client does not reconnect; the test
            // closes the EventSource explicitly.
        },
    }), { headers: { 'content-type': 'text/event-stream' } }),
});

const url = `http://127.0.0.1:${server.port}/`;
const es = new EventSource(url);

assert.eq(es.url, url, 'url getter reflects the resolved URL');
assert.eq(es.withCredentials, false, 'withCredentials defaults to false');
assert.eq(es.readyState, EventSource.CONNECTING, 'readyState starts as CONNECTING');
assert.eq(EventSource.CONNECTING, 0, 'CONNECTING === 0');
assert.eq(EventSource.OPEN, 1, 'OPEN === 1');
assert.eq(EventSource.CLOSED, 2, 'CLOSED === 2');

const opened = Promise.withResolvers();
const messaged = Promise.withResolvers();

es.onopen = () => opened.resolve();
es.onmessage = e => messaged.resolve(e);

await opened.promise;
assert.eq(es.readyState, EventSource.OPEN, 'readyState is OPEN after the open event');

const ev = await messaged.promise;
assert.ok(ev instanceof MessageEvent, 'message is a MessageEvent');
assert.eq(ev.data, 'hello', 'data matches');
assert.eq(ev.type, 'message', 'default event type is "message"');
assert.eq(ev.origin, `http://127.0.0.1:${server.port}`, 'origin is the server origin');
assert.eq(ev.lastEventId, '', 'lastEventId defaults to the empty string');

es.close();
assert.eq(es.readyState, EventSource.CLOSED, 'readyState is CLOSED after close()');

await server.close();
