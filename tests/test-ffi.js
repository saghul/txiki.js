import assert from './assert.js';
const FFI = tjs.ffi;

(function(){
	const libm = new FFI.Lib(FFI.Lib.LIBM_NAME);
	const libc = new FFI.Lib(FFI.Lib.LIBC_NAME);
	

	const absF = new FFI.CFunction(libm.symbol('abs'), FFI.types.sint, [FFI.types.sint]);
	assert.eq(absF.call(-9), 9);

	const fabsfF = new FFI.CFunction(libm.symbol('fabsf'), FFI.types.float, [FFI.types.float]);
	assert.ok(Math.abs(fabsfF.call(-3.45) - 3.45) < 0.00001);
	assert.eq(fabsfF.call(-4), 4);

	const atoiF = new FFI.CFunction(libc.symbol('atoi'), FFI.types.sint, [FFI.types.string]);
	assert.eq(atoiF.call("1234"), 1234);

	const strerrorF = new FFI.CFunction(libc.symbol('strerror'), FFI.types.string, [FFI.types.sint]);
	assert.eq(strerrorF.call(0), "Success");

	const sprintfF3 = new FFI.CFunction(libc.symbol('sprintf'), FFI.types.sint, [FFI.types.buffer, FFI.types.string, FFI.types.sint], 1);
	const strbuf = FFI.types.string.alloc(14);
	assert.eq(sprintfF3.call(strbuf, 'printf test %d\n', 5), 14);
	assert.eq((new TextDecoder()).decode(strbuf), 'printf test 5\n');

	const strcatF = new FFI.CFunction(libc.symbol('strcat'), FFI.types.string, [FFI.types.buffer, FFI.types.string]);
	const strbuf2 = FFI.types.string.alloc(12, "part1:");
	assert.eq(strcatF.call(strbuf2, "part2"), "part1:part2");
	assert.eq((new TextDecoder()).decode(strbuf2), "part1:part2\0");
})();
