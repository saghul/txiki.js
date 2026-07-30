import assert from 'tjs:assert';
import { FFI } from './helpers/ffi.js';

// A struct used as a field type is laid out inline, by value: the nested bytes
// live in the outer buffer, at the offset libffi assigned them.
const { defineStruct } = FFI;

const inner = defineStruct([ [ 'x', 'i32' ], [ 'y', 'i32' ] ]);
const outer = defineStruct([ [ 'tag', 'u8' ], [ 'a', inner ], [ 'b', inner ] ]);

assert.eq(outer.size, 4 + inner.size * 2);

const bytes = outer.pack({ tag: 7, a: { x: 1, y: 2 }, b: { x: -3, y: -4 } });

assert.eq(bytes.length, outer.size);
assert.eq(outer.unpack(bytes), { tag: 7, a: { x: 1, y: 2 }, b: { x: -3, y: -4 } });

// The nested fields really are inline rather than behind a pointer: reading the
// outer bytes at the nested field's offset yields the nested struct.
const [ , a ] = outer.describe();

assert.eq(inner.unpack(bytes.subarray(a.offset, a.offset + inner.size)), { x: 1, y: 2 });
