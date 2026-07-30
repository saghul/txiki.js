import assert from 'tjs:assert';
import { FFI, sopath } from './helpers/ffi.js';

const { types, close } = FFI.dlopenCProto(sopath, `
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

assert.eq(types.get('asdasd').size, 2*FFI.types.pointer.size);
assert.eq(types.get('asdasd2').size, FFI.types.pointer.size);

close();
