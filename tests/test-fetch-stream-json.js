import assert from 'tjs:assert';

// Response body as ReadableStream can be consumed via json()
const response = await fetch('https://postman-echo.com/get');
const json = await response.json();

assert.eq(typeof json, 'object', 'json() returns object');
assert.ok(json.url, 'json has url property');
