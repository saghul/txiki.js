import assert from 'tjs:assert';
import { FFI, sopath } from './helpers/ffi.js';
const { dlopen, types } = FFI;

// jscallback is only meaningful as an argument type. A symbol declaring it as
// its return type must not take the fast call path (which would hand back a
// bare native pointer); it keeps falling back to the marshalling path, whose
// fromBuffer rejects it.
const { symbols, close } = dlopen(sopath, {
    simple_func1: { args: [ types.sint ], returns: types.jscallback() },
});

let caught;

try {
    symbols.simple_func1(1);
} catch (e) {
    caught = e;
}

assert.ok(caught instanceof Error, 'a jscallback return type should throw');
assert.eq(caught.message, 'JSCallback as a return is not supported!');

close();
