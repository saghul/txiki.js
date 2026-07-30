import assert from 'tjs:assert';
import { FFI, sopath } from './helpers/ffi.js';

// A defineStruct() result is a type like any other: it can be a dlopen() symbol's
// argument or return type, and the struct is then passed and returned by value.
const { defineStruct } = FFI;

// struct test { int a; char b; uint64_t c; };
const test = defineStruct([ [ 'a', 'i32' ], [ 'b', 'char' ], [ 'c', 'u64' ] ]);

const { symbols, close } = FFI.dlopen(sopath, {
    // char* sprint_struct_byval_test(struct test t);
    sprint_struct_byval_test: { args: [ test ], returns: 'cstring' },
    // struct test return_struct_test(int a);
    return_struct_test: { args: [ 'i32' ], returns: test },
});

assert.eq(symbols.sprint_struct_byval_test({ a: -7, b: 120, c: 5000000000n }), 'a: -7, b: 120, c: 5000000000');
assert.eq(symbols.return_struct_test(42), { a: 42, b: 98, c: 123n });

close();
