import assert from 'tjs:assert';
import { FFI, sopath } from './helpers/ffi.js';

// A struct declared in the header, a typedef of it, and functions taking and
// returning it: the functions come back as bound callables, the types keyed by
// the name they were declared under.
const { symbols, types, close } = FFI.dlopenCProto(sopath, `
	struct test{
		int a;
		char b;
		uint64_t c;
	};
	typedef struct test s_test;
	s_test return_struct_test(int a);
	char* sprint_struct_test(s_test* t);
`);

const structTest = types.get('struct test');

assert.eq(structTest, types.get('s_test'));

const structData = {
	a: 1, b: 2, c: 3
};
const tmBuf = structTest.toBuffer(structData);
const expect = 'a: 1, b: 2, c: 3';

assert.eq(symbols.sprint_struct_test(FFI.Pointer.createRefFromBuf(structTest, tmBuf)), expect);
assert.eq(symbols.sprint_struct_test(FFI.Pointer.createRef(structTest, structData)), expect);

// A struct return, i.e. a signature dlopen() cannot fast-call, is bound too.
assert.eq(symbols.return_struct_test(10), { a: 10, b: 'b'.charCodeAt(0), c: 123 });

close();
