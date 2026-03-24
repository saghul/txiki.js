import assert from 'tjs:assert';
import text from './fixtures/hello.txt' with { type: "text" };


assert.eq(typeof text, 'string', 'text import is a string');
assert.eq(text.trim(), 'Hello, txiki.js!', 'text content matches');
