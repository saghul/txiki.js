import assert from 'tjs:assert';
import { FFI, sopath } from './helpers/ffi.js';
const { dlopen, types, Pointer } = FFI;

// A data symbol always binds at level 1; a global with a deeper indirection —
// here `int *test_int_ptr` — is reached by rebuilding the Pointer at the same
// address with the level it actually has. Keeping the bound Pointer reachable is
// what keeps the library loaded, since the rebuilt one carries no pin.
const { symbols, close } = dlopen(sopath, {
    test_int_ptr: { type: types.sint },
});

const ptr = new Pointer(symbols.test_int_ptr.addr, 2, types.sint);

assert.eq(ptr.deref().deref(), 123);
assert.eq(ptr.derefAll(), 123);

close();
