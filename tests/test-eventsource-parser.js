import assert from 'tjs:assert';

const encoder = new TextEncoder();

// Exercises the SSE field parser: multi-line data, leading-space stripping,
// comment lines, unknown fields, a no-colon field, an empty-data block (which
// must dispatch nothing) and a data field with an empty value (which dispatches
// the empty string).
const body =
    'data: line1\n' +          // leading space stripped
    'data:line2\n' +           // no leading space
    '\n' +                     // -> "line1\nline2"
    ': this is a comment\n' +  // ignored
    'unknownField: nope\n' +   // ignored
    'data: value2\n' +
    '\n' +                     // -> "value2"
    'event: noData\n' +        // no data field in this block
    '\n' +                     // -> dispatches nothing (empty data buffer)
    'data\n' +                 // no-colon field, empty value
    '\n' +                     // -> "" (buffer becomes "\n", dispatched as "")
    'data: __END__\n' +
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

assert.eq(msgs.length, 3, 'the empty-data block dispatches nothing');
assert.eq(msgs[0], 'line1\nline2', 'multi-line data joined with newlines, leading space stripped');
assert.eq(msgs[1], 'value2', 'comment and unknown fields are ignored');
assert.eq(msgs[2], '', 'a data field with an empty value dispatches the empty string');

es.close();
await server.close();
