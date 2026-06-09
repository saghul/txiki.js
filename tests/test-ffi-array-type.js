import assert from 'tjs:assert';
import { FFI } from './helpers/ffi.js';

// ArrayType.toBuffer encodes a JS array into the C array layout and fromBuffer
// reads it back.
const i32x3 = new FFI.ArrayType(FFI.types.sint32, 3, 'i32x3');
const buf = i32x3.toBuffer([ 10, 20, 30 ]);

assert.eq(buf.length, 3 * 4);
assert.eq(i32x3.fromBuffer(buf), [ 10, 20, 30 ]);

// An array of structs uses the struct's true size as the stride.
const pt = new FFI.StructType([ [ 'x', FFI.types.sint32 ], [ 'y', FFI.types.sint32 ] ], 'pt');
const pts = new FFI.ArrayType(pt, 2, 'pt2');

assert.eq(pts.size, 2 * pt.size);

const ptsBuf = pts.toBuffer([ { x: 1, y: 2 }, { x: 3, y: 4 } ]);

assert.eq(ptsBuf.length, pts.size);
assert.eq(pts.fromBuffer(ptsBuf), [ { x: 1, y: 2 }, { x: 3, y: 4 } ]);
