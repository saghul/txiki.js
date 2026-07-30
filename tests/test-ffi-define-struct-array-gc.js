import assert from 'tjs:assert';
import { FFI, sopath } from './helpers/ffi.js';

// An array field stores the address of a buffer pack() allocated for the elements.
// That address is invisible to the GC, so the packed struct has to keep the buffer
// alive by itself: without the retention model a GC between pack() and the C call
// frees the very bytes the library is about to read.
const { defineStruct } = FFI;

const span = defineStruct([
    [ 'data', [ 'u8' ] ],
    [ 'len', 'size_t', { lengthOf: 'data' } ],
]);

const { symbols, close } = FFI.dlopen(sopath, {
    // unsigned sum_byte_span(struct byte_span* s);
    sum_byte_span: { args: [ 'pointer' ], returns: 'uint32_t' },
});

function packSpan() {
    // Both the array and the buffer pack() copied it into are unreachable once this
    // returns: all that is left is the struct, holding a raw address.
    const data = [ 1, 2, 3, 4 ].map(n => n * 10);

    return span.pack({ data });
}

const bytes = packSpan();

tjs.engine.gc.run();

// Read through the stored address from C ...
assert.eq(symbols.sum_byte_span(bytes), 100);
// ... and from JS.
assert.eq(span.unpack(bytes).data, [ 10, 20, 30, 40 ]);

close();

// One level further out: the elements are themselves pointers, so the element
// buffer's own retained strings have to survive along with it.
const argv = defineStruct([
    [ 'args', [ 'cstring' ] ],
    [ 'argc', 'int', { lengthOf: 'args' } ],
]);

function packArgv() {
    return argv.pack({ args: [ [ 'tj', 's' ].join(''), [ 'ru', 'n' ].join('') ] });
}

const packed = packArgv();

tjs.engine.gc.run();

assert.eq(argv.unpack(packed), { args: [ 'tjs', 'run' ], argc: 2 });
