import assert from 'tjs:assert';
import { FFI, sopath } from './helpers/ffi.js';

const testlib = new FFI.Lib(sopath);

const testIntSymbol = testlib.symbol('test_int');
const testIntPointer = new FFI.Pointer(testIntSymbol.addr, 1, FFI.types.sint);
assert.eq(testIntPointer.deref(), 123);
assert.eq(testIntPointer.derefAll(), 123);

const testIntPtrSymbol = testlib.symbol('test_int_ptr');
const testIntPtrPointer = new FFI.Pointer(testIntPtrSymbol.addr, 2, FFI.types.sint);
assert.eq(testIntPtrPointer.deref().deref(), 123);
assert.eq(testIntPtrPointer.derefAll(), 123);
