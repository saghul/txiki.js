import assert from 'tjs:assert';
import { FFI } from './helpers/ffi.js';

// PointerType marshals a Pointer, a native pointer, or null. Anything else —
// notably a plain object someone expects to be passed by reference — must throw
// instead of being silently coerced to a NULL pointer.
const pt = new FFI.StructType([ [ 'a', FFI.types.sint ] ], 'a');
const ptrT = new FFI.PointerType(pt, 1);

let threw = false;

try {
    ptrT.toBuffer({ a: 1 });
} catch (e) {
    threw = true;
    assert.ok(/createRef/.test(e.message), 'error should point at Pointer.createRef');
}

assert.ok(threw, 'passing a plain object to a PointerType should throw');

// Valid inputs still work: null and a Pointer produced by createRef.
ptrT.toBuffer(null);
ptrT.toBuffer(FFI.Pointer.createRef(pt, { a: 1 }));
