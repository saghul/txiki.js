// Collecting one Instance must not free anything another Instance of the
// same Module still calls through when it invokes its imported function.

import assert from 'tjs:assert';

// (module (import "env" "cb" (func (param i32) (result i32)))
//         (func (export "run") (param i32) (result i32) local.get 0 call 0))
const bytes = new Uint8Array([
    0, 97, 115, 109, 1, 0, 0, 0, 1, 6, 1, 96, 1, 127, 1, 127, 2, 10, 1, 3, 101, 110, 118, 2, 99, 98, 0, 0,
    3, 2, 1, 0, 7, 7, 1, 3, 114, 117, 110, 0, 1, 10, 8, 1, 6, 0, 32, 0, 16, 0, 11,
]);

const mod = new WebAssembly.Module(bytes);

// Out of scope once it returns, so the instance is only reachable from garbage.
function dropInstance(k) {
    const inst = new WebAssembly.Instance(mod, { env: { cb: x => x + 1000 + k } });

    assert.eq(inst.exports.run(1), 1001 + k);
}

for (let k = 0; k < 30; k++) {
    dropInstance(k);

    const live = new WebAssembly.Instance(mod, { env: { cb: x => x + 2 } });

    tjs.engine.gc.run();

    // Allocation pressure, so freed memory gets reused.
    const junk = [];

    for (let j = 0; j < 200; j++) {
        junk.push({ j, s: `junk-${j}`, a: new Uint8Array(64) });
    }

    for (let j = 0; j < 5; j++) {
        assert.eq(live.exports.run(10 + j), 12 + j, 'live instance calls its own import');
    }
}
