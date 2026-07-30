import assert from 'tjs:assert';
import { FFI, sopath } from './helpers/ffi.js';

// A cstring field with a length field of its own is C's counted string
// (`char* s; int n`), which need not be NUL terminated at all. Packing derives
// the byte count from the string and unpacking reads exactly that many bytes
// instead of scanning for a NUL.
const { defineStruct } = FFI;

// struct str_test { char* s; int n; };
const counted = defineStruct([
    [ 's', 'cstring' ],
    [ 'n', 'int', { lengthOf: 's' } ],
]);

assert.eq(counted.unpack(counted.pack({ s: 'hello' })), { s: 'hello', n: 5 });

const { symbols, close } = FFI.dlopen(sopath, {
    // char* sprint_str_test(struct str_test* t);
    sprint_str_test: { args: [ 'pointer' ], returns: 'cstring' },
});

// The derived count reaches C, and the terminator is written even though it is
// not counted, so a consumer that goes by either finds what it expects.
assert.eq(symbols.sprint_str_test(counted.pack({ s: 'hello' })), 'hello:5');

close();

// The count is in bytes, not in code units: 'é' is two and '🌍' is four.
assert.eq(counted.unpack(counted.pack({ s: 'héllo🌍' })), { s: 'héllo🌍', n: 10 });

// A null string is a null pointer with a count of zero.
assert.eq(counted.unpack(counted.pack({ s: null })), { s: null, n: 0 });

// The same layout without the pairing, used to write a count of the field's own
// choosing (and endian-agnostically, unlike a DataView poke).
const raw = defineStruct([ [ 's', 'cstring' ], [ 'n', 'int' ] ]);

// Unpacking really does honour the count rather than the NUL: the bytes spell
// 'hello' but the struct says two of them.
assert.eq(counted.unpack(raw.pack({ s: 'hello', n: 2 })).s, 'he');

// A count of zero is the empty string, not null: the pointer is there.
assert.eq(counted.unpack(raw.pack({ s: 'hello', n: 0 })).s, '');
