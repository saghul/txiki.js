import assert from 'tjs:assert';
import { FFI, sopath } from './helpers/ffi.js';

// allocStruct() hands out zeroed struct bytes with a buffer already allocated and
// wired up for each named array field — the shape a C function that fills a struct
// in expects to be handed. Reading the result back is a plain unpack().
const { allocStruct, defineStruct } = FFI;

// struct int_list { unsigned count; int* items; };
const list = defineStruct([
    [ 'count', 'uint32_t', { lengthOf: 'items' } ],
    [ 'items', [ 'int' ] ],
]);

const allocated = allocStruct(list, { lengths: { items: 4 } });

assert.eq(allocated.bytes.length, list.size);
assert.eq(allocated.arrays.items.length, 4 * 4, 'four ints worth of element bytes');

// The count is written and the pointer points at the elements before C sees any of
// it, so the callee knows how much room it has.
assert.eq(list.unpack(allocated.bytes), { count: 4, items: [ 0, 0, 0, 0 ] });

const { symbols, close } = FFI.dlopen(sopath, {
    // void fill_int_list(struct int_list* l);
    fill_int_list: { args: [ 'pointer' ] },
});

symbols.fill_int_list(allocated.bytes);

assert.eq(list.unpack(allocated.bytes), { count: 4, items: [ 10, 20, 30, 40 ] });

// The exposed sub-buffer is the very memory C wrote into, not a copy.
assert.eq(new Int32Array(allocated.arrays.items.buffer)[0], 10);

close();

// Without any lengths it is just zeroed bytes: an array field is then a null
// pointer with a count of zero.
const bare = allocStruct(list);

assert.eq(bare.bytes.length, list.size);
assert.eq(Object.keys(bare.arrays), []);
assert.eq(list.unpack(bare.bytes), { count: 0, items: [] });

// A run of zero elements has no address to take, so the field stays null.
assert.eq(list.unpack(allocStruct(list, { lengths: { items: 0 } }).bytes), { count: 0, items: [] });

// A counted string is the same idea with a stride of one byte: room for C to write
// a string into, and a count for it to set.
const str = defineStruct([ [ 's', 'cstring' ], [ 'n', 'int', { lengthOf: 's' } ] ]);
const room = allocStruct(str, { lengths: { s: 16 } });

assert.eq(room.arrays.s.length, 16);
assert.eq(str.unpack(room.bytes).n, 16);

// A field with no length field cannot be sized, and a typo in a field name has to
// be an error rather than a silently skipped allocation.
assert.throws(() => allocStruct(list, { lengths: { count: 4 } }), TypeError);
assert.throws(() => allocStruct(list, { lengths: { nope: 4 } }), TypeError);
assert.throws(() => allocStruct(list, { lengths: { items: -1 } }), RangeError);
assert.throws(() => allocStruct(list, { size: 4 }), TypeError);
assert.throws(() => allocStruct({}, { lengths: {} }), TypeError);
