import assert from 'tjs:assert';

// Response body as ReadableStream can be consumed via arrayBuffer()
const response = await fetch('https://postman-echo.com/get');
const buffer = await response.arrayBuffer();

assert.ok(buffer instanceof ArrayBuffer, 'arrayBuffer() returns ArrayBuffer');
assert.ok(buffer.byteLength > 0, 'buffer has data');
