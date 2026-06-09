import assert from 'tjs:assert';
import { FFI, sopath } from './helpers/ffi.js';

// A JSCallback that throws must surface a catchable error to the caller instead
// of aborting the whole process.
const lib = new FFI.Lib(sopath);
const callCallback = new FFI.CFunction(lib.symbol('call_callback'), FFI.types.sint, [ FFI.types.jscallback, FFI.types.sint ]);

const throwing = new FFI.JSCallback(FFI.types.sint, [ FFI.types.sint ], () => {
    throw new Error('boom from callback');
});

let caught;

try {
    callCallback.call(throwing, 5);
} catch (e) {
    caught = e;
}

assert.ok(caught instanceof Error, 'callback error should propagate as a catchable exception');
assert.eq(caught.message, 'boom from callback');

// The runtime is still usable afterwards: a well-behaved callback works.
const doubler = new FFI.JSCallback(FFI.types.sint, [ FFI.types.sint ], n => n * 2);

assert.eq(callCallback.call(doubler, 21), 42);
