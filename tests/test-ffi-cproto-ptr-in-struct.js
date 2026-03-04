import assert from 'tjs:assert';
import { FFI, sopath } from './helpers/ffi.js';

const testlib = new FFI.Lib(sopath);
testlib.parseCProto(`
struct a{
	int a;
	int b;
};
typedef struct {
	struct a* filter;
	struct a* filter2;
} asdasd;
typedef struct {
	int c;
	int d;
	int e;
	int f;
}* asdasd2;
`);
assert.eq(testlib.getType('asdasd').size, 2*FFI.types.pointer.size);
assert.eq(testlib.getType('asdasd2').size, FFI.types.pointer.size);
