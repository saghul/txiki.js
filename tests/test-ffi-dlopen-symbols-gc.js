import assert from 'tjs:assert';
import { FFI, sopath } from './helpers/ffi.js';
const { dlopen, types } = FFI;

// Bound symbols must keep the library loaded on their own: neither the Lib nor
// the close() helper is retained here, so a GC used to dlclose() the library and
// leave the bound functions pointing at unmapped memory.
function open() {
    const { symbols } = dlopen(sopath, {
        simple_func1: { args: [ types.sint ], returns: types.sint },
        int_to_string: { args: [ 'sint' ], returns: 'string' },
    });

    return symbols;
}

const symbols = open();

tjs.engine.gc.run();

assert.eq(symbols.simple_func1(41), 42);
assert.eq(symbols.int_to_string(789), '789');
