import assert from 'tjs:assert';
import { FFI } from './helpers/ffi.js';

// unpackList() reads `count` structs packed back to back, which is what a C
// function that returns an array of them leaves behind.
const { defineStruct } = FFI;

const cursor = defineStruct([ [ 'row', 'u32' ], [ 'col', 'u32' ] ]);
const buf = new Uint8Array(cursor.size * 2);

buf.set(cursor.pack({ row: 1, col: 2 }), 0);
buf.set(cursor.pack({ row: 3, col: 4 }), cursor.size);

const list = cursor.unpackList(buf, 2);

assert.eq(list, [ { row: 1, col: 2 }, { row: 3, col: 4 } ]);

// Each element is an object of its own, not the same one handed out twice.
list[0].row = 9;
assert.eq(list[1].row, 3);

assert.eq(cursor.unpackList(buf, 1), [ { row: 1, col: 2 } ]);
assert.eq(cursor.unpackList(buf, 0), []);

// More structs than the buffer holds is a refusal, not a read past the end.
assert.throws(() => cursor.unpackList(buf, 3), RangeError);
assert.throws(() => cursor.unpackList(buf, -1), RangeError);
assert.throws(() => cursor.unpackList(buf, 1.5), RangeError);

// A field that reaches outside the struct — a count paired with an array — is
// resolved relative to the element being read, so every element finds its own.
const span = defineStruct([
    [ 'data', [ 'u8' ] ],
    [ 'len', 'u32', { lengthOf: 'data' } ],
]);
const spans = new Uint8Array(span.size * 2);
// Copying packed bytes elsewhere copies the element addresses but not what keeps
// them alive, so the packed buffers have to stay reachable themselves.
const first = span.pack({ data: [ 1, 2 ] });
const second = span.pack({ data: [ 3, 4, 5 ] });

spans.set(first, 0);
spans.set(second, span.size);

assert.eq(span.unpackList(spans, 2), [ { data: [ 1, 2 ], len: 2 }, { data: [ 3, 4, 5 ], len: 3 } ]);
