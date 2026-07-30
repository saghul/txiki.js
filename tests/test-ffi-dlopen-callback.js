import assert from 'tjs:assert';
import { FFI, sopath } from './helpers/ffi.js';
const { dlopen, types, JSCallback } = FFI;

// Callbacks can be declared directly in the symbol map — no separate
// Lib/CFunction needed. A jscallback argument marshals as a plain pointer, so
// such a symbol is eligible for dlopen()'s fast call path.
const { symbols, close } = dlopen(sopath, {
    call_callback: { args: [types.jscallback(), types.sint], returns: types.sint },
});

let recv = null;
const cb = new JSCallback(types.sint, [types.sint], a => {
    recv = a;

    return a + 1;
});

assert.eq(symbols.call_callback(cb, 41), 42);
assert.eq(recv, 41);

// Proof that this symbol really is on the fast path: a non-JSCallback in a
// callback slot is rejected by fast_call's own check, which names the argument
// index. The CFunction fallback would instead throw the plain Error thrown by
// types.jscallback().toBuffer().
let caught;

try {
    symbols.call_callback({}, 1);
} catch (e) {
    caught = e;
}

assert.ok(caught instanceof TypeError, 'a non-JSCallback should be rejected by fast_call');
assert.eq(caught.message, 'argument 1 must be a JSCallback');

// A single shared jscallback type instance is what makes the identity-based
// fast path check above possible.
assert.ok(types.jscallback() === types.jscallback(), 'types.jscallback() should be a singleton');

close();
