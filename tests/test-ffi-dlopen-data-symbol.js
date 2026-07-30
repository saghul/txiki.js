import assert from 'tjs:assert';
import { FFI, sopath } from './helpers/ffi.js';
const { dlopen, types, Pointer } = FFI;

// A `{ type }` entry declares a data symbol: it binds to a level-1 Pointer at
// the global's address instead of a callable, so deref() reads the global.
const { symbols, close } = dlopen(sopath, {
    test_int: { type: 'int' },
});

assert.ok(symbols.test_int instanceof Pointer, 'data symbol is a Pointer');
assert.eq(symbols.test_int.level, 1);
// 'int' resolves through the same alias table as returns/args.
assert.ok(symbols.test_int.type === types.sint32, 'pointee type is the resolved alias');
assert.ok(!symbols.test_int.isNull, 'data symbol address is not NULL');

assert.eq(symbols.test_int.deref(), 123);
assert.eq(symbols.test_int.derefAll(), 123);

close();
