import assert from 'tjs:assert';
import { FFI, sopath } from './helpers/ffi.js';

const testlib = new FFI.Lib(sopath);
testlib.parseCProto(`
	char* test_strcat(char* a, char* b);
	struct test{
		int a;
		char b;
		uint64_t c;
	};
	typedef struct test s_test;
	s_test return_struct_test(int a);
	char* sprint_struct_test(s_test* t);
`);

const strcatF = new FFI.CFunction(testlib.symbol('test_strcat'), FFI.types.string, [FFI.types.buffer, FFI.types.string]);
const strbuf2 = new Uint8Array(12);
strbuf2.set((new TextEncoder()).encode('part1:'));
assert.eq(strcatF.call(strbuf2, "part2"), "part1:part2");
assert.eq(FFI.bufferToString(strbuf2), "part1:part2");

const structTest = testlib.getType('struct test');
assert.eq(structTest, testlib.getType('s_test'));
const structData = {
	a: 1, b: 2, c: 3
};
const tmBuf = structTest.toBuffer(structData);
const expect = 'a: 1, b: 2, c: 3';
assert.eq(testlib.call('sprint_struct_test', FFI.Pointer.createRefFromBuf(structTest, tmBuf)), expect);
assert.eq(testlib.call('sprint_struct_test', FFI.Pointer.createRef(structTest, structData)), expect);
