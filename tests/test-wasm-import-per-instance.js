// Two Instances of one Module must each call their own imported function.
// WAMR links imports once per module, so the function to call is looked up
// on the instance at call time.

import assert from 'tjs:assert';

// (module (import "env" "cb" (func (param i32) (result i32)))
//         (func (export "run") (param i32) (result i32) local.get 0 call 0))
const bytes = new Uint8Array([
    0, 97, 115, 109, 1, 0, 0, 0, 1, 6, 1, 96, 1, 127, 1, 127, 2, 10, 1, 3, 101, 110, 118, 2, 99, 98, 0, 0,
    3, 2, 1, 0, 7, 7, 1, 3, 114, 117, 110, 0, 1, 10, 8, 1, 6, 0, 32, 0, 16, 0, 11,
]);

const mod = new WebAssembly.Module(bytes);
const a = new WebAssembly.Instance(mod, { env: { cb: x => x + 1 } });
const b = new WebAssembly.Instance(mod, { env: { cb: x => x + 2 } });

assert.eq(a.exports.run(10), 11, 'first instance calls its own import');
assert.eq(b.exports.run(10), 12, 'second instance calls its own import');

for (let k = 0; k < 10; k++) {
    assert.eq(b.exports.run(k), k + 2, 'interleaved call on the second instance');
    assert.eq(a.exports.run(k), k + 1, 'interleaved call on the first instance');
}

// An exception thrown by one instance's import comes out of that instance's
// export unchanged and does not affect the other instance.
const err = new RangeError('from c');
const c = new WebAssembly.Instance(mod, { env: { cb: () => {
    throw err;
} } });

assert.throws(() => c.exports.run(1), RangeError, 'import exception propagates');

try {
    c.exports.run(1);
} catch (e) {
    assert.eq(e, err, 'the original error object is rethrown');
}

assert.eq(a.exports.run(1), 2, 'first instance unaffected');
assert.eq(b.exports.run(1), 3, 'second instance unaffected');

// A Module linked by an earlier instance still requires every function import.
assert.throws(() => new WebAssembly.Instance(mod, { env: {} }), WebAssembly.LinkError, 'missing import');
