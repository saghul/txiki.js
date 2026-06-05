// The view methods return an ExternalArrayBuffer: a real ArrayBuffer with a
// detach() method that invalidates the view without reading or freeing the
// aliased native memory.

import assert from 'tjs:assert';
import { FFI, sopath } from './helpers/ffi.js';

const { ExternalArrayBuffer, read } = FFI;

const lib = new FFI.Lib(sopath);
const intPtr = lib.symbol('test_int').addr;

// It is a real ArrayBuffer and an ExternalArrayBuffer.
const ab = intPtr.toArrayBuffer(4);
assert.ok(ab instanceof ArrayBuffer, 'instanceof ArrayBuffer');
assert.ok(ab instanceof ExternalArrayBuffer, 'instanceof ExternalArrayBuffer');
assert.eq(Object.prototype.toString.call(ab), '[object ExternalArrayBuffer]', 'toStringTag');
assert.eq(ab.byteLength, 4, 'inherits byteLength');
assert.eq(ab.detached, false, 'inherits detached getter');

// detach() neutralizes the buffer.
ab.detach();
assert.eq(ab.detached, true, 'buffer is detached');
assert.eq(ab.byteLength, 0, 'detached buffer has zero length');

// The Uint8Array view shares an ExternalArrayBuffer, so detaching it neutralizes
// the typed array too.
const u8 = intPtr.toUint8Array(4);
assert.ok(u8.buffer instanceof ExternalArrayBuffer, 'u8.buffer is an ExternalArrayBuffer');
assert.eq(u8.length, 4);

u8.buffer.detach();

assert.eq(u8.length, 0, 'typed array over detached buffer is empty');
assert.eq(u8[0], undefined, 'indexed read returns undefined, not freed memory');

// The native memory itself is untouched: a fresh view still reads it.
assert.eq(read.i32(intPtr), 123, 'detach did not free or corrupt the memory');

// Detaching an already-detached buffer is a harmless no-op.
ab.detach();
assert.eq(ab.detached, true);

// detach() rejects an incompatible receiver.
assert.throws(() => ExternalArrayBuffer.prototype.detach.call({}), TypeError, 'detach on non-buffer throws');

// ExternalArrayBuffer is not constructible.
assert.throws(() => new ExternalArrayBuffer(8), TypeError, 'not constructible');

lib.close();
