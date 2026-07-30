import assert from 'tjs:assert';
import { FFI, sopath } from './helpers/ffi.js';

// `asPointer` on a nested-struct field stores the address of a buffer of its own
// instead of laying the struct out inline, which is how C spells an optional or
// shared sub-struct (`struct limits*`). Unpacking reads back through the pointer.
const { defineStruct, types } = FFI;

// struct limits { uint32_t min_size; uint32_t max_size; };
const limits = defineStruct([ [ 'minSize', 'uint32_t' ], [ 'maxSize', 'uint32_t' ] ]);

// struct device_desc { uint32_t id; struct limits* limits; };
const desc = defineStruct([
    [ 'id', 'uint32_t' ],
    [ 'limits', limits, { asPointer: true, optional: true } ],
]);

// One pointer wide, not the eight bytes the struct would take inline.
assert.eq(desc.describe()[1].size, types.pointer.size);

const bytes = desc.pack({ id: 7, limits: { minSize: 16, maxSize: 1024 } });

assert.eq(desc.unpack(bytes), { id: 7, limits: { minSize: 16, maxSize: 1024 } });

const { symbols, close } = FFI.dlopen(sopath, {
    // int device_desc_span(struct device_desc* d);
    device_desc_span: { args: [ 'pointer' ], returns: 'int' },
    // void set_device_limits(struct device_desc* d, uint32_t, uint32_t);
    set_device_limits: { args: [ 'pointer', 'uint32_t', 'uint32_t' ] },
});

// C follows the stored address ...
assert.eq(symbols.device_desc_span(bytes), 1008);

// ... and writes through it, which unpacking then reads: the pointer is at a real
// buffer, not a copy made on the way out.
symbols.set_device_limits(bytes, 100, 200);
assert.eq(desc.unpack(bytes).limits, { minSize: 100, maxSize: 200 });

// A null pointer unpacks to null rather than to a struct of zeroes, since the
// two mean different things to the C function reading it.
const none = desc.pack({ id: 1, limits: null });

assert.eq(desc.unpack(none), { id: 1, limits: null });
assert.eq(symbols.device_desc_span(none), -1);

// An absent optional field is the same null.
assert.eq(desc.unpack(desc.pack({ id: 2 })), { id: 2, limits: null });
assert.eq(symbols.device_desc_span(desc.pack({ id: 2 })), -1);

close();
