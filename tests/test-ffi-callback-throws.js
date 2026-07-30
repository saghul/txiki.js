import assert from 'tjs:assert';
import { FFI, sopath } from './helpers/ffi.js';

// A JSCallback that throws must surface a catchable error to the caller instead
// of aborting the whole process.
const { symbols, close } = FFI.dlopen(sopath, {
    call_callback: { args: [ FFI.types.jscallback(), FFI.types.sint ], returns: FFI.types.sint },
});

const throwing = new FFI.JSCallback(FFI.types.sint, [ FFI.types.sint ], () => {
    throw new Error('boom from callback');
});

let caught;

try {
    symbols.call_callback(throwing, 5);
} catch (e) {
    caught = e;
}

assert.ok(caught instanceof Error, 'callback error should propagate as a catchable exception');
assert.eq(caught.message, 'boom from callback');

// The runtime is still usable afterwards: a well-behaved callback works.
const doubler = new FFI.JSCallback(FFI.types.sint, [ FFI.types.sint ], n => n * 2);

assert.eq(symbols.call_callback(doubler, 21), 42);

close();
