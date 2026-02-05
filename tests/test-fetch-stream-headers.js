import assert from 'tjs:assert';

// Early header access - headers available before body complete
const response = await fetch('https://postman-echo.com/get');

// Headers should be available immediately after fetch resolves
assert.ok(response.headers instanceof Headers, 'headers are available');
assert.ok(response.headers.get('content-type'), 'content-type header exists');
assert.eq(response.status, 200, 'status is available');

// Body should still be readable
const data = await response.json();

assert.ok(data, 'body is readable');
