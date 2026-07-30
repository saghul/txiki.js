import assert from 'tjs:assert';
import { FFI, sopath } from './helpers/ffi.js';

const entry_t = new FFI.StructType([['a', FFI.types.sint]]);
const entry_ptr_t = new FFI.PointerType(entry_t, 1);
const { symbols, close } = FFI.dlopen(sopath, {
	open_test_handle: { args: [FFI.types.sint], returns: FFI.types.pointer },
	get_next_entry: { args: [FFI.types.pointer], returns: entry_ptr_t },
	close_test_handle: { args: [FFI.types.pointer], returns: FFI.types.void },
});

const handle = symbols.open_test_handle(5);
let i = 0;
let entry;
do{
	entry = symbols.get_next_entry(handle);
	if(!entry.isNull){
		i++;
		const obj = entry.deref();
		assert.eq(typeof obj, 'object');
		assert.eq(obj.a, i);
	}
}while(!entry.isNull);
symbols.close_test_handle(handle);
assert.eq(i, 5);

close();
