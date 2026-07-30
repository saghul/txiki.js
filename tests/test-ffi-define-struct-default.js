import assert from 'tjs:assert';
import { FFI } from './helpers/ffi.js';

// A field with a `default` may be left out of the object being packed; the
// default is then what lands in the bytes.
const { defineStruct, createPointer } = FFI;

const config = defineStruct([
    [ 'id', 'u32' ],
    [ 'timeout', 'u32', { default: 5000 } ],
    [ 'verbose', 'bool_u32', { default: false } ],
    [ 'name', 'cstring', { default: 'anon' } ],
]);

assert.eq(config.unpack(config.pack({ id: 1 })),
          { id: 1, timeout: 5000, verbose: false, name: 'anon' });

// A value given for the field wins over the default.
assert.eq(config.unpack(config.pack({ id: 2, timeout: 10, verbose: true, name: 'x' })),
          { id: 2, timeout: 10, verbose: true, name: 'x' });

// The default fills in for an absent field, not for a null one: null is the
// value a pointer or a cstring field takes for a null address.
const target = defineStruct([ [ 'ptr', 'pointer', { default: createPointer(0x1234n) } ] ]);

assert.ok(target.unpack(target.pack({})).ptr.equals(createPointer(0x1234n)), 'default pointer');
assert.eq(target.unpack(target.pack({ ptr: null })).ptr, null);

// A field with no default is still required.
assert.throws(() => config.pack({ timeout: 1 }), TypeError);
