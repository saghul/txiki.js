import assert from 'tjs:assert';
import { FFI, sopath } from './helpers/ffi.js';
const { dlopen } = FFI;

// An optional entry whose symbol is missing is left out of `symbols` instead of
// failing the whole dlopen(), which is how a symbol that only exists in some
// versions of a library is probed for.
const { symbols, close } = dlopen(sopath, {
    simple_func1: { args: [ 'int' ], returns: 'int' },
    nonexistent_symbol: { args: [], returns: 'int', optional: true },
    test_int: { type: 'int', optional: true },
});

assert.ok(!('nonexistent_symbol' in symbols), 'missing optional symbol is absent');

// An optional symbol that does resolve is bound as usual.
assert.eq(symbols.simple_func1(41), 42);
assert.eq(symbols.test_int.deref(), 123);

close();
