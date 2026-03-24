import assert from 'tjs:assert';
import bytes from './fixtures/hello.txt' with { type: "bytes" };


assert.ok(bytes instanceof Uint8Array, 'bytes import is a Uint8Array');
const text = new TextDecoder().decode(bytes).trim();
assert.eq(text, 'Hello, txiki.js!', 'bytes content matches');
