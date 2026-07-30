import assert from 'tjs:assert';
import { FFI, sopath } from './helpers/ffi.js';
const { dlopen } = FFI;

// A data symbol and a function signature are mutually exclusive; an entry
// carrying both is a caller mistake, rejected before the library is opened.
assert.throws(() => {
    dlopen(sopath, {
        test_int: { type: 'int', returns: 'int' },
    });
}, TypeError);

assert.throws(() => {
    dlopen(sopath, {
        test_int: { type: 'int', args: [] },
    });
}, TypeError);

// The error names the offending symbol.
assert.throws(() => {
    dlopen(sopath, {
        simple_func1: { args: [ 'int' ], returns: 'int' },
        test_int: { type: 'int', returns: 'int' },
    });
}, /test_int/);
