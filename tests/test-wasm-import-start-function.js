// A start function runs inside instantiation, before the Instance exists on
// the JS side; its import calls must still reach that instance's function.

import assert from 'tjs:assert';

// (module (import "env" "cb" (func)) (func call 0) (start 1))
const bytes = new Uint8Array([
    0, 97, 115, 109, 1, 0, 0, 0, 1, 4, 1, 96, 0, 0, 2, 10, 1, 3, 101, 110, 118, 2, 99, 98, 0, 0,
    3, 2, 1, 0, 8, 1, 1, 10, 6, 1, 4, 0, 16, 0, 11,
]);

const mod = new WebAssembly.Module(bytes);
const calls = [];

new WebAssembly.Instance(mod, { env: { cb: () => calls.push('a') } });
new WebAssembly.Instance(mod, { env: { cb: () => calls.push('b') } });

assert.eq(calls.join(','), 'a,b', 'each start function calls its own import');

// Instantiating the same Module from inside a start function.
calls.length = 0;
new WebAssembly.Instance(mod, { env: { cb: () => {
    calls.push('outer');
    new WebAssembly.Instance(mod, { env: { cb: () => calls.push('inner') } });
} } });

assert.eq(calls.join(','), 'outer,inner', 'nested instantiation calls the right imports');

const err = new RangeError('from start');

try {
    new WebAssembly.Instance(mod, { env: { cb: () => {
        throw err;
    } } });
    assert.ok(false, 'should have thrown');
} catch (e) {
    assert.eq(e, err, 'an exception from a start-function import propagates');
}
