import assert from 'tjs:assert';
import { FFI, sopath } from './helpers/ffi.js';

const testlib = new FFI.Lib(sopath);
const sym = testlib.symbol('simple_func1');
const ptr = sym.addr;

// NativePointer prototype has a null prototype (no Object.prototype in chain).
const proto = Object.getPrototypeOf(ptr);
assert.eq(Object.getPrototypeOf(proto), null);

// Own methods work.
assert.ok(typeof ptr.toString() === 'string');
assert.ok(ptr.toString().startsWith('0x'));
assert.ok(ptr.equals(ptr));
assert.ok(!ptr.equals(null));

// offset returns a NativePointer with the same prototype chain.
const ptr2 = ptr.offset(1);
assert.eq(Object.getPrototypeOf(ptr2), proto);
assert.ok(!ptr.equals(ptr2));

// No inherited Object.prototype methods.
assert.eq(ptr.hasOwnProperty, undefined);
assert.eq(ptr.valueOf, undefined);
assert.eq(ptr.constructor, undefined);
