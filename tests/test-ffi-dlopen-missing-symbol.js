import assert from 'tjs:assert';
import { FFI, sopath } from './helpers/ffi.js';
const { dlopen, types } = FFI;

// A symbol that cannot be resolved throws, and dlopen closes the library handle
// before rethrowing. The close itself is not observable from JS — the Lib never
// escapes a failed dlopen() — so what is asserted here is that the failure
// happens *after* at least one symbol has been bound, which is the path that
// used to leave the handle open until the Lib was finalized.
// The rethrown error is the resolution failure itself, not anything the close
// produced.
assert.throws(() => {
    dlopen(sopath, {
        simple_func1: { args: [ types.sint ], returns: types.sint },
        nonexistent_symbol: { args: [], returns: 'int' },
    });
}, /uv_dlsym/);

// The library still opens fine afterwards.
const { symbols, close } = dlopen(sopath, {
    simple_func1: { args: [ types.sint ], returns: types.sint },
});

assert.eq(symbols.simple_func1(41), 42);
close();
