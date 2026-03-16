import assert from 'tjs:assert';

// Echo server that reads the streaming request body and echoes it back.
const server = tjs.serve({
    async fetch(request) {
        const body = await request.text();

        return new Response(body, {
            headers: { 'Content-Type': 'text/plain' },
        });
    },
});

const url = `http://127.0.0.1:${server.port}/post`;

// Streaming request body with ReadableStream
const chunks = [ 'hello', ' ', 'world' ];
let chunkIndex = 0;

const stream = new ReadableStream({
    pull(controller) {
        if (chunkIndex < chunks.length) {
            controller.enqueue(new TextEncoder().encode(chunks[chunkIndex]));
            chunkIndex++;
        } else {
            controller.close();
        }
    },
});

const response = await fetch(url, {
    method: 'POST',
    body: stream,
    duplex: 'half',
    headers: { 'Content-Type': 'text/plain' },
});

assert.eq(response.status, 200, 'status is 200');

const text = await response.text();

assert.eq(text, 'hello world', 'streaming body was received correctly');

server.close();
