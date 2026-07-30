import assert from 'tjs:assert';
import { FFI, sopath } from './helpers/ffi.js';

const sizeofFuncs = [
	'sizeof_sllong',
	'sizeof_slong',
	'sizeof_sint',
	'sizeof_sshort',
	'sizeof_schar',
	'sizeof_float',
	'sizeof_double',
	'sizeof_pointer',
	'sizeof_size_t',
	'sizeof_ulong',
	'sizeof_ullong',
];

const sizeofLib = FFI.dlopenCProto(sopath, sizeofFuncs.map(fname => `size_t ${fname}();`).join('\n'));
for(const fname of sizeofFuncs){
	const tname = fname.replace('sizeof_', '').replace(/_t$/, '');
	assert.eq(sizeofLib.symbols[fname](), FFI.types[tname].size);
}
sizeofLib.close();

const { types, close } = FFI.dlopenCProto(sopath, `
	typedef long long int test_lli;
	typedef long long test_ll;
	typedef long int test_li;
	typedef unsigned long long int test_ulli;
	typedef unsigned long long test_ull;
	typedef unsigned long test_ul;
	typedef unsigned int test_uli;
`);

const test_lli = types.get('test_lli');
const test_ll = types.get('test_ll');
const test_li = types.get('test_li');
const test_ulli = types.get('test_ulli');
const test_ull = types.get('test_ull');
const test_ul = types.get('test_ul');
const test_uli = types.get('test_uli');
assert.eq(test_lli, FFI.types.sllong);
assert.eq(test_ll, FFI.types.sllong);
assert.eq(test_li, FFI.types.slong);
assert.eq(test_ulli, FFI.types.ullong);
assert.eq(test_ull, FFI.types.ullong);
assert.eq(test_ul, FFI.types.ulong);
assert.eq(test_uli, FFI.types.uint);
close();
