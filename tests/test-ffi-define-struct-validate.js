import assert from 'tjs:assert';
import { FFI } from './helpers/ffi.js';

// A `validate` function runs on pack and rejects by throwing; it gets the value,
// the field name to put in its message, and the object being packed.
const { defineStruct } = FFI;

const seen = [];
const user = defineStruct([
    [ 'id', 'u32', {
        validate: (value, field, { input }) => {
            seen.push([ value, field, input.id ]);

            if (value < 1) {
                throw new RangeError(`${field} must be positive`);
            }
        },
    } ],
    // An array of validators: every one of them runs.
    [ 'age', 'u8', {
        validate: [
            (value, field) => {
                if (value < 0) {
                    throw new RangeError(`${field} must not be negative`);
                }
            },
            (value, field) => {
                if (value > 150) {
                    throw new RangeError(`${field} is not a human age`);
                }
            },
        ],
    } ],
]);

assert.eq(user.unpack(user.pack({ id: 3, age: 30 })), { id: 3, age: 30 });
assert.eq(seen, [ [ 3, 'id', 3 ] ]);

assert.throws(() => user.pack({ id: 0, age: 30 }), RangeError);
assert.throws(() => user.pack({ id: 1, age: 200 }), RangeError);

try {
    user.pack({ id: 1, age: 200 });
} catch (e) {
    assert.eq(e.message, 'age is not a human age');
}

// A default is validated like any other value: it is what gets packed.
const port = defineStruct([
    [ 'port', 'u32', {
        default: 0,
        validate: (value, field) => {
            if (value === 0) {
                throw new RangeError(`${field} must be set`);
            }
        },
    } ],
]);

assert.throws(() => port.pack({}), RangeError);
assert.eq(port.unpack(port.pack({ port: 80 })), { port: 80 });

// A validator has to be callable.
assert.throws(() => defineStruct([ [ 'n', 'u32', { validate: 'nope' } ] ]), TypeError);
