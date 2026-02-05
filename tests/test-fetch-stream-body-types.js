import assert from 'tjs:assert';

// Request body from various sources

// String body
const r1 = await fetch('https://postman-echo.com/post', {
    method: 'POST',
    body: 'hello string',
    headers: { 'Content-Type': 'text/plain' }
});

assert.eq(r1.status, 200);

const j1 = await r1.json();

assert.eq(j1.data, 'hello string');

// ArrayBuffer body
const buffer = new TextEncoder().encode('hello buffer').buffer;
const r2 = await fetch('https://postman-echo.com/post', {
    method: 'POST',
    body: buffer,
    headers: { 'Content-Type': 'text/plain' }
});

assert.eq(r2.status, 200);

const j2 = await r2.json();

assert.eq(j2.data, 'hello buffer');

// Uint8Array body
const uint8 = new TextEncoder().encode('hello uint8');
const r3 = await fetch('https://postman-echo.com/post', {
    method: 'POST',
    body: uint8,
    headers: { 'Content-Type': 'text/plain' }
});

assert.eq(r3.status, 200);

const j3 = await r3.json();

assert.eq(j3.data, 'hello uint8');
