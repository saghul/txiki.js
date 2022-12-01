import { assert } from '@tjs/std';


globalThis.global = 'foo';
assert.is(globalThis, global, 'globalThis is global');

globalThis.window = 'foo';
assert.is(globalThis, window, 'globalThis is window');

globalThis.self = 'foo';
assert.is(globalThis, self, 'globalThis is self');
