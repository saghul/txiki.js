import assert from 'tjs:assert';


globalThis.self = 'foo';
assert.is(globalThis, self, 'globalThis is self');
