import assert from 'tjs:assert';
import { FFI, sopath } from './helpers/ffi.js';

// Pass a struct by value as a function argument, supplying a plain object.
// (Passing a struct through a pointer parameter is covered by
// test-ffi-dlopen-cproto.js via Pointer.createRef.)
const test_t = new FFI.StructType([
    [ 'a', FFI.types.sint ],
    [ 'b', FFI.types.uchar ],
    [ 'c', FFI.types.uint64 ],
], 'test_struct');

// char* sprint_struct_byval_test(struct test t);
const { symbols, close } = FFI.dlopen(sopath, {
    sprint_struct_byval_test: { args: [ test_t ], returns: FFI.types.string },
});

assert.eq(symbols.sprint_struct_byval_test({ a: 1, b: 2, c: 3 }), 'a: 1, b: 2, c: 3');

// A different set of values, including a negative int and a 64-bit field above
// 2**32, to make sure each field lands at the right offset rather than
// coinciding by accident. (b stays in 0..127: the C field is `char`, whose
// signedness is platform-dependent.)
assert.eq(symbols.sprint_struct_byval_test({ a: -7, b: 120, c: 5000000000 }), 'a: -7, b: 120, c: 5000000000');

close();
