import assert from 'tjs:assert';

// Issue #450 - TransformStream with Response
const { readable, writable } = new TransformStream();
const writer = writable.getWriter();
const encoder = new TextEncoder();

// Start consuming the Response in the background
const textPromise = new Response(readable).text();

// Write data through the transform stream
const chunks = [ 'hello', ' ', 'world' ];

for (const chunk of chunks) {
    await writer.ready;
    await writer.write(encoder.encode(chunk));
}

await writer.close();
await writer.closed;

// Get the result
const text = await textPromise;

assert.eq(text, 'hello world', 'TransformStream data flows through Response correctly');
