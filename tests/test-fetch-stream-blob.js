import assert from 'tjs:assert';

// Response body as ReadableStream can be consumed via blob()
const response = await fetch('https://postman-echo.com/get');
const blob = await response.blob();

assert.ok(blob instanceof Blob, 'blob() returns Blob');
assert.ok(blob.size > 0, 'blob has data');
