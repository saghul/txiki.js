import assert from 'tjs:assert';
import { FFI, sopath } from './helpers/ffi.js';
const { dlopen, types, JSCallback } = FFI;

// A jscallback argument goes through dlopen's CFunction fallback, so callbacks
// can be declared directly in the symbol map — no separate Lib/CFunction needed.
const { symbols, close } = dlopen(sopath, {
    call_callback: { args: [types.jscallback(), types.sint], returns: types.sint },
});

let recv = null;
const cb = new JSCallback(types.sint, [types.sint], a => {
    recv = a;

    return 2;
});

assert.eq(symbols.call_callback(cb, 4), 2);
assert.eq(recv, 4);

close();
