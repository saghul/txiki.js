import assert from 'tjs:assert';
import { FFI, sopath } from './helpers/ffi.js';

const test_t = new FFI.StructType([['a', FFI.types.sint], ['b', FFI.types.uchar], ['c', FFI.types.uint64]], 'test_struct');
const { symbols, close } = FFI.dlopen(sopath, {
	return_struct_test: { args: [FFI.types.sint], returns: test_t },
});
assert.equal(symbols.return_struct_test(10), {a:10, b: "b".charCodeAt(0), c: 123});

close();
