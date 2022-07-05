import assert from './assert.js';
import { CFunction, freeCif, LIBC_SO } from '@tjs/ffi'

(function(){
	let abs = new CFunction(LIBC_SO, 'abs', 1, 'int', 'int');
	assert.equal(abs.invoke(-3), 3);
	return true;
})();
