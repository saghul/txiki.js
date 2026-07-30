import assert from 'tjs:assert';
import { FFI } from './helpers/ffi.js';

// packListInto() writes a run of structs into a buffer the caller owns, at a
// chosen offset, without a buffer per element.
const { defineStruct } = FFI;

const cursor = defineStruct([ [ 'row', 'u32' ], [ 'col', 'u32' ] ]);
const cursors = [ { row: 1, col: 2 }, { row: 3, col: 4 }, { row: 5, col: 6 } ];
const buf = new Uint8Array(cursor.size * 4);

cursor.packListInto(cursors, buf, cursor.size);

// The bytes before the offset are the caller's and stay untouched.
assert.eq(Array.from(buf.subarray(0, cursor.size)), Array(cursor.size).fill(0));
assert.eq(cursor.unpackList(buf.subarray(cursor.size), 3), cursors);

// It writes into the buffer it was handed, not into a copy: unpacking the same
// bytes through a separate view sees the writes.
assert.eq(cursor.unpackInto(new DataView(buf.buffer), {}, cursor.size), cursors[0]);

// More structs than there is room for is a refusal.
assert.throws(() => cursor.packListInto(cursors, buf, cursor.size * 2), RangeError);
assert.throws(() => cursor.packListInto(cursors, buf, -1), RangeError);

// A pointer field written into a caller-owned buffer is retained against that
// buffer, so the strings survive as long as the bytes holding their addresses do.
const entry = defineStruct([ [ 'name', 'cstring' ], [ 'id', 'u32' ] ]);
const entries = new Uint8Array(entry.size * 2);

entry.packListInto([ { name: 'one', id: 1 }, { name: 'two', id: 2 } ], entries);

tjs.engine.gc.run();

assert.eq(entry.unpackList(entries, 2), [ { name: 'one', id: 1 }, { name: 'two', id: 2 } ]);
