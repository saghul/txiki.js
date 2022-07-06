import assert from './assert.js';
const { CFunction, freeCif, LIBC_SO } = tjs.ffi;

(function(){
	let abs = new CFunction(LIBC_SO, 'abs', 1, 'int', 'int');
	assert.equal(abs.invoke(-3), 3);
	return true;
})();
