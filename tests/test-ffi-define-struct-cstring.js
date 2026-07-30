import assert from 'tjs:assert';
import { FFI } from './helpers/ffi.js';

// A cstring field is a char*: packing encodes the string (NUL terminated) and
// stores its address, unpacking reads the string back. A null address is null,
// not an empty string.
const { defineStruct } = FFI;

const strTest = defineStruct([ [ 's', 'cstring' ], [ 'n', 'i32' ] ]);

assert.eq(strTest.describe()[0].size, FFI.types.pointer.size);
assert.eq(strTest.unpack(strTest.pack({ s: 'olá çç', n: 7 })), { s: 'olá çç', n: 7 });
assert.eq(strTest.unpack(strTest.pack({ s: '', n: 0 })), { s: '', n: 0 });
assert.eq(strTest.unpack(strTest.pack({ s: null, n: -1 })), { s: null, n: -1 });
