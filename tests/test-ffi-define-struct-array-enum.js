import assert from 'tjs:assert';
import { FFI } from './helpers/ffi.js';

// A [ elementType ] field can hold an enum, in which case the elements are the
// integers the enum is stored in and the JS side is a list of member names.
const { defineEnum, defineStruct } = FFI;

const color = defineEnum({ RED: 0, GREEN: 1, BLUE: 2 }, 'u8');
const palette = defineStruct([
    [ 'count', 'u32', { lengthOf: 'colors' } ],
    [ 'colors', [ color ] ],
]);

const colors = [ 'RED', 'BLUE', 'GREEN', 'BLUE' ];

assert.eq(palette.unpack(palette.pack({ colors })), { count: 4, colors });

// The stride is the enum's own width, not the widest integer around: four
// single-byte members fit in four bytes.
const wide = defineStruct([
    [ 'count', 'u32', { lengthOf: 'colors' } ],
    [ 'colors', [ defineEnum({ RED: 0, GREEN: 1 }) ] ],
]);

assert.eq(wide.unpack(wide.pack({ colors: [ 'GREEN', 'RED' ] })), { count: 2, colors: [ 'GREEN', 'RED' ] });

// An element that is not a member of the enum is refused, naming the field it was
// meant for.
assert.throws(() => palette.pack({ colors: [ 'RED', 'MAUVE' ] }), RangeError);
