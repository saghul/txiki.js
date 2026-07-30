import assert from 'tjs:assert';
import { FFI } from './helpers/ffi.js';

// A value that is not in the mapping must fail loudly, naming the field: passing
// the raw number through would write a value C has no case for, and returning it
// from unpack would make the field's type depend on the bytes.
const { defineEnum, defineStruct } = FFI;

const color = defineEnum({ RED: 0, GREEN: 1 });
const paint = defineStruct([ [ 'color', color ] ]);

assert.throws(() => paint.pack({ color: 'BLUE' }), RangeError);
assert.throws(() => paint.pack({ color: 7 }), RangeError);
// Not a member either, however tempting the mapping looks as a plain object.
assert.throws(() => paint.pack({ color: 'toString' }), RangeError);

try {
    paint.pack({ color: 'BLUE' });
} catch (e) {
    assert.ok(e.message.includes('color'), 'the failure names the field');
}

const bytes = paint.pack({ color: 'GREEN' });

bytes[0] = 9;

assert.throws(() => paint.unpack(bytes), RangeError);

try {
    paint.unpack(bytes);
} catch (e) {
    assert.ok(e.message.includes('color'), 'the failure names the field');
}

// An enum needs an integer to live in and at least one member.
assert.throws(() => defineEnum({ A: 0 }, 'f32'), TypeError);
assert.throws(() => defineEnum({ A: 0 }, 'pointer'), TypeError);
assert.throws(() => defineEnum({}), TypeError);
assert.throws(() => defineEnum({ A: 1.5 }), TypeError);
