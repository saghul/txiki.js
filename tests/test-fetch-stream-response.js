import assert from 'tjs:assert';

// Response body streaming - read response body as stream
const response = await fetch('https://postman-echo.com/bytes/10000');

assert.ok(response.body instanceof ReadableStream, 'response.body is a ReadableStream');

const reader = response.body.getReader();
let totalBytes = 0;

while (true) {
    const { done, value } = await reader.read();

    if (done) {
        break;
    }

    assert.ok(value instanceof Uint8Array, 'chunk is Uint8Array');
    totalBytes += value.byteLength;
}

assert.ok(totalBytes > 0, 'received data from stream');
