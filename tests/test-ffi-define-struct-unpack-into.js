import assert from 'tjs:assert';
import { FFI } from './helpers/ffi.js';

// unpackInto() writes the fields straight into an object the caller owns, so a
// loop over a run of structs can reuse one object instead of allocating a result
// per element.
const { defineStruct } = FFI;

const cursor = defineStruct([ [ 'row', 'u32' ], [ 'col', 'u32' ] ]);
const buf = new Uint8Array(cursor.size * 2);

buf.set(cursor.pack({ row: 1, col: 2 }), 0);
buf.set(cursor.pack({ row: 3, col: 4 }), cursor.size);

const target = {};

assert.ok(cursor.unpackInto(buf, target) === target, 'hands back the object it was given');
assert.eq(target, { row: 1, col: 2 });

// The offset selects which struct in the buffer is read, into the same object.
cursor.unpackInto(buf, target, cursor.size);
assert.eq(target, { row: 3, col: 4 });

// Only the struct's own fields are touched; whatever else the caller keeps there
// stays.
target.mine = 'kept';
cursor.unpackInto(buf, target, 0);
assert.eq(target, { row: 1, col: 2, mine: 'kept' });

// A DataView is as good as a typed array, and so is a subarray of a larger buffer.
assert.eq(cursor.unpackInto(new DataView(buf.buffer, cursor.size), {}), { row: 3, col: 4 });

// A read that would run off the end is refused rather than clamped.
assert.throws(() => cursor.unpackInto(buf, target, cursor.size + 1), RangeError);
assert.throws(() => cursor.unpackInto(buf, target, -1), RangeError);
