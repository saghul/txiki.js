import assert from 'tjs:assert';
import { FFI, sopath } from './helpers/ffi.js';
const { dlopen, types, JSCallback } = FFI;

// A JSCallback that throws must surface a catchable error on the fast call path
// too, not abort the process (fast_call checks for a pending exception once
// ffi_call returns).
const { symbols, close } = dlopen(sopath, {
    call_callback: { args: [ types.jscallback(), types.sint ], returns: types.sint },
});

const throwing = new JSCallback(types.sint, [ types.sint ], () => {
    throw new Error('boom from fast path callback');
});

let caught;

try {
    symbols.call_callback(throwing, 5);
} catch (e) {
    caught = e;
}

assert.ok(caught instanceof Error, 'callback error should propagate as a catchable exception');
assert.eq(caught.message, 'boom from fast path callback');

// The runtime is still usable afterwards: a well-behaved callback works.
const doubler = new JSCallback(types.sint, [ types.sint ], n => n * 2);

assert.eq(symbols.call_callback(doubler, 21), 42);

close();
