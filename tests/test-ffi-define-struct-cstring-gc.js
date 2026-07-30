import assert from 'tjs:assert';
import { FFI, sopath } from './helpers/ffi.js';

// A cstring field stores the address of a buffer pack() allocated. That address
// is invisible to the GC, so the packed struct has to keep the buffer alive by
// itself: without the retention model a GC between pack() and the C call frees
// the bytes the library is about to read.
const { defineStruct } = FFI;

const strTest = defineStruct([ [ 's', 'cstring' ], [ 'n', 'i32' ] ]);

// char* sprint_str_test(struct str_test* t);
const { symbols, close } = FFI.dlopen(sopath, {
    sprint_str_test: { args: [ 'pointer' ], returns: 'cstring' },
});

function pack() {
    // Both the string and the buffer pack() encoded it into are unreachable once
    // this returns: all that is left is the struct, holding a raw address.
    const s = [ 're', 'tained' ].join('');

    return strTest.pack({ s, n: 7 });
}

const bytes = pack();

tjs.engine.gc.run();

// Read through the stored address from C ...
assert.eq(symbols.sprint_str_test(bytes), 'retained:7');
// ... and from JS.
assert.eq(strTest.unpack(bytes).s, 'retained');

close();
