import assert from 'tjs:assert';
import { FFI } from './helpers/ffi.js';

// A pointer field and the field holding its element count only mean anything as a
// pair, so a definition that does not spell out a working pair is rejected when the
// struct is defined rather than when something reads garbage.
const { defineStruct } = FFI;

// Nothing says how many elements are behind the pointer, so unpacking it could
// never work.
assert.throws(() => defineStruct([ [ 'items', [ 'u8' ] ] ]), TypeError);

// A count naming a field that is not there.
assert.throws(() => defineStruct([ [ 'n', 'u32', { lengthOf: 'nope' } ], [ 'x', 'u32' ] ]), TypeError);

// A count naming a field that is neither an array nor a cstring.
assert.throws(() => defineStruct([ [ 'n', 'u32', { lengthOf: 'x' } ], [ 'x', 'u32' ] ]), TypeError);

// A count has to be an integer.
assert.throws(() => defineStruct([ [ 'n', 'f32', { lengthOf: 's' } ], [ 's', 'cstring' ] ]), TypeError);

// Two fields cannot both count the same one.
assert.throws(() => defineStruct([
    [ 'a', 'u32', { lengthOf: 's' } ],
    [ 'b', 'u32', { lengthOf: 's' } ],
    [ 's', 'cstring' ],
]), TypeError);

// The count is derived from the field it counts, so an option that would supply or
// reshape a value of its own can only mislead.
for (const options of [ { default: 3 }, { optional: true }, { packTransform: v => v }, { validate: () => {} } ]) {
    assert.throws(
        () => defineStruct([ [ 'n', 'u32', { lengthOf: 's', ...options } ], [ 's', 'cstring' ] ]),
        TypeError,
        `lengthOf with ${Object.keys(options)[0]}`);
}

// The element type goes in a one-element array; anything else is a typo.
assert.throws(() => defineStruct([ [ 'items', [] ] ]), TypeError);
assert.throws(() => defineStruct([ [ 'items', [ 'u8', 'u8' ] ] ]), TypeError);

// asPointer only means something for a nested struct.
assert.throws(() => defineStruct([ [ 'n', 'u32', { asPointer: true } ] ]), TypeError);

// A value that is not a list of elements would otherwise pack as a run of none.
const span = defineStruct([ [ 'data', [ 'u8' ] ], [ 'len', 'u32', { lengthOf: 'data' } ] ]);

assert.throws(() => span.pack({ data: 5 }), TypeError);

// C handing back a null pointer with a non-zero count is inconsistent, and reading
// the elements anyway would dereference null.
// The same layout without the pairing, so the count can be written on its own
// (and without a DataView poke that would have to know the byte order).
const raw = defineStruct([ [ 'data', 'pointer' ], [ 'len', 'u32' ] ]);

assert.eq(span.describe().map(f => f.offset), raw.describe().map(f => f.offset));
assert.throws(() => span.unpack(raw.pack({ data: null, len: 3 })), RangeError);
