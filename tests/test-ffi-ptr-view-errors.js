// Argument validation for the zero-copy view methods.

import assert from 'tjs:assert';
import { FFI } from './helpers/ffi.js';

const { bufferToPointer } = FFI;

const buf = new Uint8Array(8);
const ptr = bufferToPointer(buf);

// A negative byteLength is rejected.
assert.throws(() => ptr.toUint8Array(-1), RangeError, 'toUint8Array rejects negative length');
assert.throws(() => ptr.toArrayBuffer(-1), RangeError, 'toArrayBuffer rejects negative length');

// Null pointers are represented as JavaScript `null`, which has no view methods,
// so attempting to view one throws.
assert.throws(() => null.toUint8Array(4), TypeError, 'cannot view a null pointer');
