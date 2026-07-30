import assert from 'tjs:assert';
import { FFI, sopath } from './helpers/ffi.js';

// An ArrayType field is an array laid out *inside* the struct (`char name[8]`,
// `int cells[4]`), as opposed to the [ elementType ] syntax, which is a pointer to
// elements somewhere else. StaticStringType is the `char[N]`-as-a-JS-string case.
const { ArrayType, StaticStringType, defineStruct, types } = FFI;

// struct grid { char name[8]; int cells[4]; };
const grid = defineStruct([
    [ 'name', new StaticStringType(8, 'char[8]') ],
    [ 'cells', new ArrayType(types.sint32, 4, 'int[4]') ],
]);

const { symbols, close } = FFI.dlopen(sopath, {
    sizeof_struct_grid: { returns: 'size_t' },
    offsetof_struct_grid_cells: { returns: 'size_t' },
    // char* sprint_grid(struct grid* g);
    sprint_grid: { args: [ 'pointer' ], returns: 'cstring' },
});

// The array members take their full width in the layout, which is what makes the
// struct agree with the C compiler's idea of it.
assert.eq(grid.size, symbols.sizeof_struct_grid());
assert.eq(grid.describe().map(f => f.size), [ 8, 16 ]);
assert.eq(grid.describe()[1].offset, symbols.offsetof_struct_grid_cells());

const bytes = grid.pack({ name: 'abc', cells: [ 1, -2, 3, -4 ] });

assert.eq(bytes.length, 24);
assert.eq(grid.unpack(bytes), { name: 'abc', cells: [ 1, -2, 3, -4 ] });

// The bytes are the array, in the struct, where C reads them: nothing here is a
// pointer to anything.
assert.eq(symbols.sprint_grid(bytes), 'abc:1,-2,3,-4');

close();

// A string longer than the member is a failure rather than a truncation.
assert.throws(() => grid.pack({ name: '123456789', cells: [ 0, 0, 0, 0 ] }), RangeError);

// An inline array nests like any other field, and the unused tail is zeroed.
const outer = defineStruct([ [ 'tag', 'u8' ], [ 'g', grid ] ]);
const nested = outer.pack({ tag: 1, g: { name: 'hi', cells: [ 0, 0, 0, 0 ] } });

assert.eq(outer.unpack(nested), { tag: 1, g: { name: 'hi', cells: [ 0, 0, 0, 0 ] } });
