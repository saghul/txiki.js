import assert from 'tjs:assert';
import { FFI, sopath } from './helpers/ffi.js';

const testlib = new FFI.Lib(sopath);

const test_t = new FFI.StructType([['a', FFI.types.sint], ['b', FFI.types.uchar], ['c', FFI.types.uint64]], 'test_struct');
const return_struct_test = new FFI.CFunction(testlib.symbol('return_struct_test'), test_t, [FFI.types.sint]);
assert.equal(return_struct_test.call(10), {a:10, b: "b".charCodeAt(0), c: 123});
