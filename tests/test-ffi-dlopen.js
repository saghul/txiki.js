import assert from 'tjs:assert';
import { FFI, sopath } from './helpers/ffi.js';
const { dlopen, types, bufferToString } = FFI;

// Test dlopen with both type objects and string aliases.
const { symbols, close } = dlopen(sopath, {
    // Type objects.
    simple_func1: { args: [types.sint], returns: types.sint },
    simple_func3: { args: [types.double], returns: types.double },
    // String aliases.
    parse_int: { args: ['string'], returns: 'int' },
    int_to_string: { args: ['sint'], returns: 'string' },
    test_sprintf: { args: ['buffer', 'string', 'i32'], returns: 'int', fixed: 2 },
});

// Type objects.
assert.eq(symbols.simple_func1(-9), -8);
assert.eq(symbols.simple_func1(0), 1);
assert.ok(Math.abs(symbols.simple_func3(98.9) - 99.9) < 0.00001);

// String aliases.
assert.eq(symbols.parse_int('42'), 42);
assert.eq(symbols.int_to_string(789), '789');

const buf = new Uint8Array(15);
assert.eq(symbols.test_sprintf(buf, 'test %d\n', 7), 7);
assert.eq(bufferToString(buf), 'test 7\n');

close();

// Test unknown type throws.
assert.throws(() => {
    dlopen(sopath, {
        simple_func1: { args: ['nonexistent'], returns: 'int' },
    });
}, TypeError);
