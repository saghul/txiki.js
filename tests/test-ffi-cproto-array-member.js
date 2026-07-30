import assert from 'tjs:assert';
import { FFI, sopath } from './helpers/ffi.js';

// A header parsed by dlopenCProto must size array members by their full width,
// not as a single element (e.g. `char name[16]` is 16 bytes, not 1).
const { types, close } = FFI.dlopenCProto(sopath, `
    struct named {
        int id;
        char name[16];
    };
`);

const named = types.get('struct named');

// int (4) + char[16] (16) => 20 bytes.
assert.eq(named.size, 4 + 16);

close();

// Unsized array members are rejected rather than silently mis-sized.
assert.throws(
    () => FFI.dlopenCProto(sopath, `struct flex { int n; char data[]; };`),
    'unsized array member should be rejected');
