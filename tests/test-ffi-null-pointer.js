import assert from 'tjs:assert';
import { FFI, sopath } from './helpers/ffi.js';

// A C function returning NULL comes back as `null`, both through dlopen's
// 'ptr' alias and through CFunction with types.pointer.
const { symbols, lib, close } = FFI.dlopen(sopath, {
    open_test_handle: { args: [ 'uint' ], returns: 'ptr' },
    get_next_entry: { args: [ 'ptr' ], returns: 'ptr' },
    close_test_handle: { args: [ 'ptr' ] },
});

const handle = symbols.open_test_handle(1);

assert.ok(handle !== null, 'open_test_handle returned a pointer');
assert.ok(symbols.get_next_entry(handle) !== null, 'first entry is not NULL');
assert.eq(symbols.get_next_entry(handle), null, 'exhausted handle yields null');

const getNextEntry = new FFI.CFunction(lib.symbol('get_next_entry'), FFI.types.pointer, [ FFI.types.pointer ]);

assert.eq(getNextEntry.call(handle), null, 'exhausted handle yields null via CFunction');

symbols.close_test_handle(handle);
close();

// null round-trips through the pointer marshaller.
assert.eq(FFI.types.pointer.fromBuffer(FFI.types.pointer.toBuffer(null)), null);
