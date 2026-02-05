import assert from 'tjs:assert';

// Issue #646 - Response.body should be a ReadableStream
const response = new Response('test body', {
    status: 200,
    headers: { 'Content-Type': 'text/plain' }
});

assert.ok(response.body instanceof ReadableStream, 'Response.body is a ReadableStream');

// Also test with different body types
const response2 = new Response(new Uint8Array([ 1, 2, 3 ]));

assert.ok(response2.body instanceof ReadableStream, 'Response.body from Uint8Array is a ReadableStream');

const response3 = new Response(null);

assert.eq(response3.body, null, 'Response.body from null is null');
