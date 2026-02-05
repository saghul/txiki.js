import assert from 'tjs:assert';

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
    }
});

const response = await fetch('https://postman-echo.com/post', {
    method: 'POST',
    body: stream,
    duplex: 'half',
    headers: { 'Content-Type': 'text/plain' }
});

assert.eq(response.status, 200, 'status is 200');

const json = await response.json();

assert.eq(json.data, 'hello world', 'streaming body was received correctly');
