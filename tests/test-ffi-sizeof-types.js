import assert from 'tjs:assert';
import { FFI, sopath } from './helpers/ffi.js';

const testlib = new FFI.Lib(sopath);
testlib.parseCProto(`
	size_t sizeof_sllong();
	size_t sizeof_slong();
	size_t sizeof_sint();
	size_t sizeof_sshort();
	size_t sizeof_schar();
	size_t sizeof_float();
	size_t sizeof_double();
	size_t sizeof_pointer();
	size_t sizeof_size_t();
	size_t sizeof_ulong();
	size_t sizeof_ullong();
`);
for(const [fname] of testlib._funcs.entries()){
	const tname = fname.replace('sizeof_', '').replace(/_t$/, '');
	assert.eq(testlib.call(fname), FFI.types[tname].size);
}
testlib.parseCProto(`
	typedef long long int test_lli;
	typedef long long test_ll;
	typedef long int test_li;
	typedef unsigned long long int test_ulli;
	typedef unsigned long long test_ull;
	typedef unsigned long test_ul;
	typedef unsigned int test_uli;
`);

const test_lli = testlib.getType('test_lli');
const test_ll = testlib.getType('test_ll');
const test_li = testlib.getType('test_li');
const test_ulli = testlib.getType('test_ulli');
const test_ull = testlib.getType('test_ull');
const test_ul = testlib.getType('test_ul');
const test_uli = testlib.getType('test_uli');
assert.eq(test_lli, FFI.types.sllong);
assert.eq(test_ll, FFI.types.sllong);
assert.eq(test_li, FFI.types.slong);
assert.eq(test_ulli, FFI.types.ullong);
assert.eq(test_ull, FFI.types.ullong);
assert.eq(test_ul, FFI.types.ulong);
assert.eq(test_uli, FFI.types.uint);
