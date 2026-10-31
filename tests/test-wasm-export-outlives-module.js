// Regression for #1078: an export wrapper must keep its Module alive. Once the
// JS Instance and Module are unreachable, the export function alone still has
// to be callable.

import assert from 'tjs:assert';

// (module (import "env" "cb" (func (param i32) (result i32)))
//         (func (export "run") (param i32) (result i32) local.get 0 call 0))
const bytes = new Uint8Array([
    0, 97, 115, 109, 1, 0, 0, 0, 1, 6, 1, 96, 1, 127, 1, 127, 2, 10, 1, 3, 101, 110, 118, 2, 99, 98, 0, 0,
    3, 2, 1, 0, 7, 7, 1, 3, 114, 117, 110, 0, 1, 10, 8, 1, 6, 0, 32, 0, 16, 0, 11,
]);

function getExport() {
    const mod = new WebAssembly.Module(bytes);
    const inst = new WebAssembly.Instance(mod, { env: { cb: x => x } });

    return inst.exports.run;
}

for (let k = 0; k < 25; k++) {
    const run = getExport();

    for (let i = 0; i < 20; i++) {
        new ArrayBuffer(1024 * 1024);
    }

    tjs.engine.gc.run();

    assert.eq(run(k), k, 'export is callable after its Instance and Module are unreachable');
}
