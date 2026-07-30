import assert from 'tjs:assert';
import { FFI, sopath } from './helpers/ffi.js';

// defineStruct must take its layout from libffi — the only thing here that knows
// the platform ABI — rather than computing offsets in JS. Checked twice: against
// the equivalent hand-built StructType, and against what the C compiler did to
// the same struct in the fixture library.
const { defineStruct, types, StructType } = FFI;

// struct test { int a; char b; uint64_t c; };
const test = defineStruct([ [ 'a', 'i32' ], [ 'b', 'char' ], [ 'c', 'u64' ] ]);
const handBuilt = new StructType([
    [ 'a', types.sint32 ],
    [ 'b', types.schar ],
    [ 'c', types.uint64 ],
], 'test');

assert.eq(test.size, handBuilt.ffiType.size);
assert.eq(test.align, handBuilt.ffiType.alignment);
assert.eq(test.describe().map(f => f.offset), [ ...handBuilt.ffiType.offsets ]);

const { symbols, close } = FFI.dlopen(sopath, {
    sizeof_struct_test: { returns: 'size_t' },
    offsetof_struct_test_b: { returns: 'size_t' },
    offsetof_struct_test_c: { returns: 'size_t' },
});

assert.eq(test.size, symbols.sizeof_struct_test());
assert.eq(test.describe()[1].offset, symbols.offsetof_struct_test_b());
assert.eq(test.describe()[2].offset, symbols.offsetof_struct_test_c());

close();

// A byte followed by a 64-bit field: on an ABI where uint64_t is 8 bytes wide
// but 4-aligned (i386, ARM EABI) `c` sits at offset 4 and the struct is 12 bytes,
// which is precisely what a JS layout loop assuming `align == size` gets wrong.
const bumpy = defineStruct([ [ 'b', 'u8' ], [ 'c', 'u64' ] ]);
const bumpyHandBuilt = new StructType([ [ 'b', types.uint8 ], [ 'c', types.uint64 ] ], 'bumpy');

assert.eq(bumpy.size, bumpyHandBuilt.ffiType.size);
assert.eq(bumpy.align, bumpyHandBuilt.ffiType.alignment);
assert.eq(bumpy.describe().map(f => f.offset), [ ...bumpyHandBuilt.ffiType.offsets ]);

// A nested struct is where size and alignment part ways on every ABI: `inner` is
// 8 bytes wide but 4-aligned, so it follows a single byte at offset 4.
const inner = defineStruct([ [ 'a', 'i32' ], [ 'b', 'u8' ] ]);
const outer = defineStruct([ [ 'c', 'u8' ], [ 'inner', inner ] ]);
const outerHandBuilt = new StructType([ [ 'c', types.uint8 ], [ 'inner', inner ] ], 'outer');

assert.eq(inner.align, 4);
assert.eq(inner.size, 8);
assert.eq(outer.describe().map(f => f.offset), [ ...outerHandBuilt.ffiType.offsets ]);
assert.eq(outer.size, outerHandBuilt.ffiType.size);
