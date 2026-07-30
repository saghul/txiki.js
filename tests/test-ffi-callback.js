import assert from 'tjs:assert';
import { FFI, sopath } from './helpers/ffi.js';

const { symbols, close } = FFI.dlopen(sopath, {
    call_callback: { args: [ FFI.types.jscallback(), FFI.types.sint ], returns: FFI.types.sint },
});

let recv = null;

const callback = new FFI.JSCallback(FFI.types.sint, [ FFI.types.sint ], a => {
    recv = a;

    return 2;
});

assert.eq(symbols.call_callback(callback, 4), 2);
assert.eq(recv, 4);

close();
