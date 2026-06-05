// NativePointer.toUint8Array / toArrayBuffer create zero-copy views that alias
// native memory directly (no copy).

import assert from 'tjs:assert';
import { FFI, sopath } from './helpers/ffi.js';

const { read } = FFI;

const lib = new FFI.Lib(sopath);

// `test_int` is an exported `int` initialised to 123; its symbol address is the
// address of the variable itself.
const intPtr = lib.symbol('test_int').addr;

assert.eq(read.i32(intPtr), 123, 'sanity: test_int is 123');

// A Uint8Array view aliases the native bytes: each byte matches a direct read at
// the same address (endianness-agnostic, both read the same memory).
const view = intPtr.toUint8Array(4);
assert.ok(view instanceof Uint8Array);
assert.eq(view.length, 4);

for (let i = 0; i < 4; i++) {
    assert.eq(view[i], read.u8(intPtr, i), `byte ${i} matches read.u8`);
}

// Writing through the view mutates the native memory (proves it is not a copy).
const orig = view.slice();

view[0] = 0xff;
assert.eq(read.u8(intPtr, 0), 0xff, 'write through view is visible to native read');
view.set(orig);
assert.eq(read.i32(intPtr), 123, 'restored');

// byteOffset starts the view further into the memory.
const tail = intPtr.toUint8Array(2, 1);
assert.eq(tail.length, 2);
assert.eq(tail[0], read.u8(intPtr, 1));
assert.eq(tail[1], read.u8(intPtr, 2));

// The ArrayBuffer variant returns a zero-copy buffer over the same memory.
const ab = intPtr.toArrayBuffer(4);
assert.ok(ab instanceof ArrayBuffer);
assert.eq(ab.byteLength, 4);

const abView = new Uint8Array(ab);

for (let i = 0; i < 4; i++) {
    assert.eq(abView[i], read.u8(intPtr, i), `arraybuffer byte ${i} matches`);
}

// The Uint8Array shares its backing buffer with the ArrayBuffer variant: both
// are views over the same native memory, so a `.buffer` is detachable.
assert.ok(view.buffer instanceof ArrayBuffer);
assert.eq(view.buffer.byteLength, 4, 'uint8 view buffer spans the same memory');

// A zero-length view is allowed and produces an empty buffer.
assert.eq(intPtr.toUint8Array(0).length, 0);
assert.eq(intPtr.toArrayBuffer(0).byteLength, 0);

lib.close();
