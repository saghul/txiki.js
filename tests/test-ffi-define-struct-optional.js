import assert from 'tjs:assert';
import { FFI } from './helpers/ffi.js';

// An `optional` field may be left out: pack writes zeroes for it instead of
// throwing, and unpack reads those zeroes back as the type's zero value.
const { defineStruct } = FFI;

const style = defineStruct([
    [ 'length', 'u32' ],
    [ 'color', 'u32', { optional: true } ],
    [ 'label', 'cstring', { optional: true } ],
    [ 'bold', 'bool_u8', { optional: true } ],
]);

assert.eq(style.unpack(style.pack({ length: 5 })),
          { length: 5, color: 0, label: null, bold: false });
assert.eq(style.unpack(style.pack({ length: 5, color: 7, label: 'hi', bold: true })),
          { length: 5, color: 7, label: 'hi', bold: true });

// `default` beats `optional`: absence is not an error either way, and what gets
// packed is the default rather than zeroes.
const both = defineStruct([ [ 'n', 'u32', { optional: true, default: 42 } ] ]);

assert.eq(both.unpack(both.pack({})), { n: 42 });

// An optional field that is absent takes the transform out of the picture: there
// is no value to transform, so zeroes go in untouched.
const transformed = defineStruct([
    [ 'n', 'u32', { optional: true, packTransform: v => v * 2 } ],
]);

assert.eq(transformed.unpack(transformed.pack({})), { n: 0 });
assert.eq(transformed.unpack(transformed.pack({ n: 3 })), { n: 6 });
