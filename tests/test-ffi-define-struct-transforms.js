import assert from 'tjs:assert';
import { FFI } from './helpers/ffi.js';

// packTransform maps a JS value to what the field stores, unpackTransform maps
// the stored value back, so a field can be spelled in the units the caller
// thinks in rather than the ones C keeps.
const { defineEnum, defineStruct } = FFI;

const status = defineEnum({ INACTIVE: 0, ACTIVE: 1, SUSPENDED: 2 });
const user = defineStruct([
    [ 'id', 'u32' ],
    [ 'age', 'u16', {
        packTransform: years => Math.floor(years * 12),
        unpackTransform: months => months / 12,
    } ],
    // A transform applies to an enum field before the member lookup, so it maps
    // one member name to another.
    [ 'status', status, { packTransform: v => (v === 'INACTIVE' ? 'SUSPENDED' : v) } ],
]);

const unpacked = user.unpack(user.pack({ id: 1, age: 2, status: 'INACTIVE' }));

assert.eq(unpacked, { id: 1, age: 2, status: 'SUSPENDED' });

// The bytes hold the transformed value: 2.5 years is stored as 30 months, and a
// struct without the transforms packs identically from 30.
const plain = defineStruct([ [ 'id', 'u32' ], [ 'age', 'u16' ], [ 'status', status.type ] ]);

assert.eq(user.pack({ id: 1, age: 2.5, status: 'ACTIVE' }),
          plain.pack({ id: 1, age: 30, status: 1 }));
assert.eq(user.unpack(user.pack({ id: 1, age: 2.5, status: 'ACTIVE' })).age, 2.5);

// unpackTransform on its own leaves the pack side alone.
const flags = defineStruct([ [ 'mask', 'u32', { unpackTransform: v => v.toString(2) } ] ]);

assert.eq(flags.unpack(flags.pack({ mask: 5 })), { mask: '101' });

// A transform has to be callable.
assert.throws(() => defineStruct([ [ 'n', 'u32', { packTransform: 3 } ] ]), TypeError);
