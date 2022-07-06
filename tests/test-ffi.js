import assert from './assert.js';
const { CFunction } = tjs.ffi;

(function(){
	let abs = new CFunction(null, 'abs', 1, 'int', 'int');
	assert.equal(abs.invoke(-3), 3);

	let abs64 = new CFunction(null, 'abs', 1, 'sint64', 'sint64');
	let res = abs64.invoke(-3);
	assert.equal(typeof res, 'bigint');
	assert.equal(res, BigInt(3));
	return true;
})();
