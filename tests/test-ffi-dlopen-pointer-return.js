import assert from 'tjs:assert';
import { FFI, sopath } from './helpers/ffi.js';
const { dlopen, types, Pointer, PointerType, StructType } = FFI;

// A PointerType return marshals as a plain pointer, so such a symbol takes
// dlopen()'s fast call path; the bound function re-wraps the NativePointer that
// fast_call hands back into the Pointer that PointerType.fromBuffer would have
// built, so .level / .type / .deref() keep working.
const entryType = new StructType([ [ 'a', types.sint ] ], 'test_handle_entry');
const entryPtrType = new PointerType(entryType, 1);

const { symbols, close } = dlopen(sopath, {
    open_test_handle: { args: [ types.uint ], returns: types.pointer },
    get_next_entry: { args: [ types.pointer ], returns: entryPtrType },
    close_test_handle: { args: [ types.pointer ] },
});

const handle = symbols.open_test_handle(2);

// Proof that get_next_entry really is on the fast path: only fast_call checks the
// argument count itself. The CFunction fallback marshals per declared argument
// type and would instead trip over the missing type for the extra argument
// ("cannot read property 'toBuffer' of undefined").
let caught;

try {
    symbols.get_next_entry(handle, 5);
} catch (e) {
    caught = e;
}

assert.ok(caught instanceof RangeError, 'arity should be checked by fast_call');
assert.eq(caught.message, 'expected 1 arguments but got 2');

const first = symbols.get_next_entry(handle);

assert.ok(first instanceof Pointer, 'a PointerType return is a Pointer, not a bare NativePointer');
assert.eq(first.level, 1);
assert.ok(first.type === entryType, 'the Pointer carries the declared pointee type');
assert.ok(!first.isNull);
assert.eq(first.deref().a, 1, 'deref() reads the pointee struct');

assert.eq(symbols.get_next_entry(handle).deref().a, 2);

// The handle is exhausted, so C returns NULL. The slow path yields
// `new Pointer(null, level, type)` — a Pointer whose isNull is true, never JS
// null — and the fast path must produce exactly the same thing.
const exhausted = symbols.get_next_entry(handle);

assert.ok(exhausted instanceof Pointer, 'a NULL PointerType return is still a Pointer');
assert.ok(exhausted.isNull, 'a NULL PointerType return has isNull true');
assert.eq(exhausted.addr, null);
assert.eq(exhausted.level, 1);
assert.ok(exhausted.type === entryType);

symbols.close_test_handle(handle);
close();
