import assert from 'tjs:assert';
import { FFI, sopath } from './helpers/ffi.js';
const { dlopen, CFunction, JSCallback, types, Lib } = FFI;

// dlopen exposes the underlying Lib, so raw symbols (e.g. for a CFunction that
// takes a JSCallback) can be built from the same handle without opening twice.
const { symbols, lib, close } = dlopen(sopath, {
    simple_func1: { args: [types.sint], returns: types.sint },
});

assert.ok(lib instanceof Lib, 'lib is a Lib instance');

const callCallback = new CFunction(lib.symbol('call_callback'), types.sint, [types.jscallback(), types.sint]);
const cb = new JSCallback(types.sint, [types.sint], a => a * 10);

assert.eq(symbols.simple_func1(0), 1);
assert.eq(callCallback.call(cb, 5), 50);

// close() and lib.close() close the same handle; the native close is
// idempotent, so calling both must not crash.
close();
lib.close();
