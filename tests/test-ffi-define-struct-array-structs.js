import assert from 'tjs:assert';
import { FFI, sopath } from './helpers/ffi.js';

// The element type of a [ elementType ] field can be another defineStruct(), i.e.
// a pointer to an array of structs. The elements are laid out back to back at the
// stride libffi gives the struct, which is the stride C indexes with.
const { defineStruct } = FFI;

// struct point { float x; float y; };
const point = defineStruct([ [ 'x', 'f32' ], [ 'y', 'f32' ] ]);

// struct polyline { struct point* points; unsigned count; };
const polyline = defineStruct([
    [ 'points', [ point ] ],
    [ 'count', 'uint32_t', { lengthOf: 'points' } ],
]);

const points = [ { x: 1, y: 2 }, { x: 3, y: 4 }, { x: 5, y: 6.5 } ];
const bytes = polyline.pack({ points });

assert.eq(polyline.unpack(bytes), { points, count: 3 });

const { symbols, close } = FFI.dlopen(sopath, {
    // float sum_polyline(struct polyline* p);
    sum_polyline: { args: [ 'pointer' ], returns: 'float' },
});

// C indexes the run with sizeof(struct point), so a mismatched stride would show
// up here as garbage rather than 21.5.
assert.eq(symbols.sum_polyline(bytes), 21.5);

close();

// A struct element may itself hold a pointer: the strings live in buffers of their
// own, whose addresses go into the element run.
const entry = defineStruct([ [ 'name', 'cstring' ], [ 'id', 'u32' ] ]);
const table = defineStruct([
    [ 'entries', [ entry ] ],
    [ 'n', 'u32', { lengthOf: 'entries' } ],
]);

const entries = [ { name: 'one', id: 1 }, { name: 'two', id: 2 } ];

assert.eq(table.unpack(table.pack({ entries })), { entries, n: 2 });
