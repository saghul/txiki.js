import assert from 'tjs:assert';
import { FFI, sopath } from './helpers/ffi.js';

const { createPointer } = FFI;

const testlib = new FFI.Lib(sopath);
const ptr = testlib.symbol('simple_func1').addr;

// `.value` is the raw address as a BigInt, non-zero for a real pointer.
assert.eq(typeof ptr.value, 'bigint', 'value is a bigint');
assert.ok(ptr.value > 0n, 'value is non-zero for a real pointer');
assert.eq('0x' + ptr.value.toString(16), ptr.toString(), 'value matches the hex from toString()');

// createPointer(p.value) reproduces the pointer exactly.
const rebuilt = createPointer(ptr.value);
assert.ok(rebuilt.equals(ptr), 'createPointer(value) equals the original');
assert.eq(rebuilt.value, ptr.value, 'round-tripped value is identical');
assert.eq(rebuilt.toString(), ptr.toString(), 'round-tripped toString is identical');

// A zero address is the null pointer, represented as JS null.
assert.eq(createPointer(0n), null, 'createPointer(0n) is null');

// BigInt only: numbers, strings and missing args are rejected rather than
// silently truncated / coerced.
assert.throws(() => createPointer(1), TypeError, 'rejects a number');
assert.throws(() => createPointer(ptr.toString()), TypeError, 'rejects a string');
assert.throws(() => createPointer(), TypeError, 'rejects no argument');
assert.throws(() => createPointer(null), TypeError, 'rejects null');

// The `value` getter is unforgeable: calling it on a non-pointer throws.
const valueGetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(ptr), 'value').get;
assert.throws(() => valueGetter.call({}), TypeError, 'value getter rejects a foreign receiver');

testlib.close();
