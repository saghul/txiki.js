import assert from 'tjs:assert';

// Response body as ReadableStream can be consumed via text()
const response = await fetch('https://postman-echo.com/get');
const text = await response.text();

assert.eq(typeof text, 'string', 'text() returns string');
assert.ok(text.length > 0, 'text has content');
