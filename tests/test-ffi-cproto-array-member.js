import assert from 'tjs:assert';
import { FFI, sopath } from './helpers/ffi.js';

// parseCProto must size array members by their full width, not as a single
// element (e.g. `char name[16]` is 16 bytes, not 1).
const lib = new FFI.Lib(sopath);

lib.parseCProto(`
    struct named {
        int id;
        char name[16];
    };
`);

const named = lib.getType('struct named');

// int (4) + char[16] (16) => 20 bytes.
assert.eq(named.size, 4 + 16);

// Unsized array members are rejected rather than silently mis-sized.
let threw = false;

try {
    new FFI.Lib(sopath).parseCProto(`struct flex { int n; char data[]; };`);
} catch {
    threw = true;
}

assert.ok(threw, 'unsized array member should be rejected');
