import assert from 'tjs:assert';
import { FFI, sopath } from './helpers/ffi.js';

const testlib = new FFI.Lib(sopath);

const callCallbackF = new FFI.CFunction(testlib.symbol('call_callback'), FFI.types.sint, [FFI.types.jscallback, FFI.types.sint]);
let recv = null;
const callback = new FFI.JSCallback(FFI.types.sint, [FFI.types.sint], (a)=>{
	recv = a;
	return 2;
});
const ret = callCallbackF.call(callback, 4);
assert.eq(ret, 2);
assert.eq(recv, 4);
