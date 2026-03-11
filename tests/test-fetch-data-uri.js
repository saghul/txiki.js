import assert from 'tjs:assert';

// Plain text data URI.
const r1 = await fetch('data:text/plain,Hello%20World');

assert.eq(r1.status, 200, 'plain text status');
assert.eq(r1.headers.get('content-type'), 'text/plain', 'plain text content-type');
assert.eq(await r1.text(), 'Hello World', 'plain text body');

// Base64-encoded data URI.
const r2 = await fetch('data:application/octet-stream;base64,AQIDBA==');

assert.eq(r2.status, 200, 'base64 status');
assert.eq(r2.headers.get('content-type'), 'application/octet-stream', 'base64 content-type');

const buf = new Uint8Array(await r2.arrayBuffer());

assert.eq(buf.length, 4, 'base64 body length');
assert.eq(buf[0], 1, 'base64 byte 0');
assert.eq(buf[1], 2, 'base64 byte 1');
assert.eq(buf[2], 3, 'base64 byte 2');
assert.eq(buf[3], 4, 'base64 byte 3');

// Default MIME type when none is specified.
const r3 = await fetch('data:,bare');

assert.eq(r3.headers.get('content-type'), 'text/plain;charset=US-ASCII', 'default content-type');
assert.eq(await r3.text(), 'bare', 'bare data URI body');

// Empty body.
const r4 = await fetch('data:text/plain,');

assert.eq(await r4.text(), '', 'empty body');

// JSON via base64.
const json = btoa('{"key":"value"}');
const r5 = await fetch(`data:application/json;base64,${json}`);

assert.deepEqual(await r5.json(), { key: 'value' }, 'json via base64');
