import assert from 'tjs:assert';
import { FFI, sopath } from './helpers/ffi.js';

// The `{ T* data; size_t len }` shape, which is most of what C hands around: a
// field declared as [ elementType ] is a pointer to a run of elements, and the
// field naming it in `lengthOf` holds how many there are. pack() allocates the
// elements and writes both halves; unpack() reads the count and materialises them.
const { defineStruct } = FFI;

// struct byte_span { unsigned char* data; size_t len; };
const span = defineStruct([
    [ 'data', [ 'u8' ] ],
    [ 'len', 'size_t', { lengthOf: 'data' } ],
]);

// The field itself is one pointer wide, whatever the run behind it holds.
assert.eq(span.describe()[0].size, FFI.types.pointer.size);
assert.ok(span.describe()[0].type.endsWith('[]'), 'describe names it as an array of its element type');

const bytes = span.pack({ data: [ 1, 2, 3, 250 ] });

// The count comes from the elements rather than from the object, so the two can
// never disagree.
assert.eq(span.unpack(bytes), { data: [ 1, 2, 3, 250 ], len: 4n });

const { symbols, close } = FFI.dlopen(sopath, {
    // unsigned sum_byte_span(struct byte_span* s);
    sum_byte_span: { args: [ 'pointer' ], returns: 'uint32_t' },
});

// C walks the pointer for `len` bytes and finds what pack() put there.
assert.eq(symbols.sum_byte_span(bytes), 256);

// A typed array packs as well as a plain one: both are just indexable.
assert.eq(symbols.sum_byte_span(span.pack({ data: new Uint8Array([ 10, 20 ]) })), 30);

// An empty run is a null pointer with a count of zero, which is what unpacking
// gives back and what C reads as "nothing here".
const empty = span.pack({ data: [] });

assert.eq(span.unpack(empty), { data: [], len: 0n });
assert.eq(symbols.sum_byte_span(empty), 0);

close();

// A wider element type strides by its own size, not by one.
const values = defineStruct([
    [ 'count', 'u32', { lengthOf: 'items' } ],
    [ 'items', [ 'f32' ] ],
]);

assert.eq(values.unpack(values.pack({ items: [ 0.5, -1.5, 2.25 ] })),
          { count: 3, items: [ 0.5, -1.5, 2.25 ] });
