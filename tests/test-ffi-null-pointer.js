import assert from 'tjs:assert';
import { FFI, sopath } from './helpers/ffi.js';

// A C function returning NULL comes back as `null`, both through dlopen's fast
// call path and through the marshalling one.
const { symbols, close } = FFI.dlopen(sopath, {
    open_test_handle: { args: [ 'uint' ], returns: 'ptr' },
    get_next_entry: { args: [ 'ptr' ], returns: 'ptr' },
    // The same C symbol bound a second time so that the call cannot be
    // fast-called — a PointerType argument is not eligible — and the NULL return
    // therefore goes through types.pointer.fromBuffer instead.
    get_next_entry_marshalled: {
        name: 'get_next_entry',
        args: [ new FFI.PointerType(FFI.types.void, 1) ],
        returns: 'ptr',
    },
    close_test_handle: { args: [ 'ptr' ] },
});

const handle = symbols.open_test_handle(1);

assert.ok(handle !== null, 'open_test_handle returned a pointer');
assert.ok(symbols.get_next_entry(handle) !== null, 'first entry is not NULL');
assert.eq(symbols.get_next_entry(handle), null, 'exhausted handle yields null');

assert.eq(symbols.get_next_entry_marshalled(handle), null, 'exhausted handle yields null when marshalled');

symbols.close_test_handle(handle);
close();

// null round-trips through the pointer marshaller.
assert.eq(FFI.types.pointer.fromBuffer(FFI.types.pointer.toBuffer(null)), null);
