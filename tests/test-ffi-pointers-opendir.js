import assert from 'tjs:assert';
import { FFI, sopath } from './helpers/ffi.js';

const testlib = new FFI.Lib(sopath);

const open_test_handle = new FFI.CFunction(testlib.symbol('open_test_handle'), FFI.types.pointer, [FFI.types.sint]);
const entry_t = new FFI.StructType([['a', FFI.types.sint]]);
const entry_ptr_t = new FFI.PointerType(entry_t, 1);
const get_next_entry = new FFI.CFunction(testlib.symbol('get_next_entry'), entry_ptr_t, [FFI.types.pointer]);
const close_test_handle = new FFI.CFunction(testlib.symbol('close_test_handle'), FFI.types.void, [FFI.types.pointer]);

const handle = open_test_handle.call(5);
let i = 0;
let entry;
do{
	entry = get_next_entry.call(handle);
	if(!entry.isNull){
		i++;
		const obj = entry.deref();
		assert.eq(typeof obj, 'object');
		assert.eq(obj.a, i);
	}
}while(!entry.isNull);
close_test_handle.call(handle);
assert.eq(i, 5);
