import assert from 'tjs:assert';
import { FFI } from './helpers/ffi.js';

// A struct of primitive fields must survive a pack / unpack round trip
// unchanged, each field in the JS type C uses for it.
const { defineStruct, createPointer, types } = FFI;

const point = defineStruct([
    [ 'i8', 'i8' ],
    [ 'u8', 'u8' ],
    [ 'i16', 'i16' ],
    [ 'u32', 'u32' ],
    [ 'i64', 'i64' ],
    [ 'u64', 'u64' ],
    [ 'f32', 'f32' ],
    [ 'f64', types.double ],
    [ 'yes', 'bool_u8' ],
    [ 'no', 'bool_u32' ],
    [ 'ptr', 'pointer' ],
    [ 'nullptr', 'pointer' ],
]);

const ptr = createPointer(0x1234n);
const values = {
    i8: -8,
    u8: 200,
    i16: -3000,
    u32: 4000000000,
    // Above 2**53, so a number could not carry it back exactly.
    i64: -9007199254740993n,
    u64: 18446744073709551615n,
    f32: 1.5,
    f64: 1e300,
    yes: true,
    no: false,
    ptr,
    nullptr: null,
};

const unpacked = point.unpack(point.pack(values));

assert.eq(unpacked.i8, -8);
assert.eq(unpacked.u8, 200);
assert.eq(unpacked.i16, -3000);
assert.eq(unpacked.u32, 4000000000);
assert.eq(unpacked.i64, -9007199254740993n);
assert.eq(unpacked.u64, 18446744073709551615n);
assert.eq(unpacked.f32, 1.5);
assert.eq(unpacked.f64, 1e300);
assert.eq(unpacked.yes, true);
assert.eq(unpacked.no, false);
// A pointer field comes back as a native pointer, and a null address as null.
assert.ok(unpacked.ptr.equals(ptr), 'pointer field round trips');
assert.eq(unpacked.nullptr, null);

// Every field is required until field options land: a missing one is a bug in
// the caller, not a zero.
assert.throws(() => point.pack({ ...values, u32: undefined }), TypeError);
