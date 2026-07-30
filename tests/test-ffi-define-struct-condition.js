import assert from 'tjs:assert';
import { FFI } from './helpers/ffi.js';

// A `condition` is answered once, when the struct is defined: a field whose
// condition is false is not in the struct at all, so it cannot show up in the
// layout or push the fields after it along — which is what a struct with a
// platform-conditional member needs.
const { defineStruct } = FFI;

let calls = 0;
const conditioned = defineStruct([
    [ 'version', 'u32' ],
    [ 'legacy', 'u32', {
        condition: () => {
            calls++;

            return false;
        },
        default: 0xffff,
    } ],
    [ 'timeout', 'u32' ],
]);

// The struct written without the field at all is the reference.
const without = defineStruct([ [ 'version', 'u32' ], [ 'timeout', 'u32' ] ]);

assert.eq(conditioned.size, without.size);
assert.eq(conditioned.align, without.align);
assert.eq(conditioned.describe(), without.describe());
assert.eq(conditioned.fields.map(([ name ]) => name), [ 'version', 'timeout' ]);

const packed = conditioned.pack({ version: 1, timeout: 5000 });

assert.eq(packed, without.pack({ version: 1, timeout: 5000 }));
// Not even its default is written, and unpack does not invent the field.
assert.eq(conditioned.unpack(packed), { version: 1, timeout: 5000 });

// Nor is the predicate consulted again on every pack.
conditioned.pack({ version: 2, timeout: 1 });
assert.eq(calls, 1);

// A true condition leaves the field exactly as it would be without one.
const included = defineStruct([
    [ 'version', 'u32' ],
    [ 'legacy', 'u32', { condition: () => true } ],
    [ 'timeout', 'u32' ],
]);

assert.eq(included.size, without.size + 4);
assert.eq(included.unpack(included.pack({ version: 1, legacy: 2, timeout: 3 })),
          { version: 1, legacy: 2, timeout: 3 });

// A struct with nothing left in it has no layout to compute.
assert.throws(() => defineStruct([ [ 'gone', 'u32', { condition: () => false } ] ]), TypeError);

// An unknown option is a typo, not a field without options.
assert.throws(() => defineStruct([ [ 'n', 'u32', { optinal: true } ] ]), TypeError);
