import assert from 'tjs:assert';
import { FFI, sopath } from './helpers/ffi.js';
const { dlopen, bufferToString } = FFI;

// With `name`, the map key is only the JS property name, so the same C symbol can
// be bound more than once. test_sprintf is variadic, and a cif is fixed at bind
// time, so each arity it is called with needs its own binding.
const { symbols, close } = dlopen(sopath, {
    sprintf1: { name: 'test_sprintf', args: [ 'buffer', 'string', 'i32' ], returns: 'int', fixed: 2 },
    sprintf2: { name: 'test_sprintf', args: [ 'buffer', 'string', 'i32', 'i32' ], returns: 'int', fixed: 2 },
    // A C name exposed under a friendlier one.
    increment: { name: 'simple_func1', args: [ 'int' ], returns: 'int' },
    // Data symbols take `name` too.
    counter: { name: 'test_int', type: 'int' },
});

const buf1 = new Uint8Array(16);

assert.eq(symbols.sprintf1(buf1, 'x=%d\n', 7), 4);
assert.eq(bufferToString(buf1), 'x=7\n');

const buf2 = new Uint8Array(16);

assert.eq(symbols.sprintf2(buf2, 'x=%d y=%d\n', 7, 8), 8);
assert.eq(bufferToString(buf2), 'x=7 y=8\n');

assert.eq(symbols.increment(41), 42);
assert.eq(symbols.counter.deref(), 123);

// Only the map keys are bound, never the C name behind them.
assert.ok(!('test_sprintf' in symbols), 'C name is not bound');
assert.ok(!('simple_func1' in symbols), 'C name is not bound');
assert.ok(!('test_int' in symbols), 'C name is not bound');

close();
