import assert from 'tjs:assert';
import { FFI, sopath } from './helpers/ffi.js';
const { dlopen } = FFI;

// A bound data symbol must keep the library loaded on its own, just like a bound
// function: neither the Lib nor the close() helper is retained here, so without
// the pin a GC dlclose()s the library and unmaps the global the Pointer points
// at.
function open() {
    const { symbols } = dlopen(sopath, {
        test_int: { type: 'int' },
    });

    return symbols.test_int;
}

const ptr = open();

tjs.engine.gc.run();

assert.eq(ptr.deref(), 123);
