// Module, Instance and an import closure that references both form one garbage
// cycle. Collecting it must not unload the WAMR module before the instance that
// uses it is deinstantiated.

import assert from 'tjs:assert';

// (module (import "env" "cb" (func (param i32) (result i32)))
//         (func (export "run") (param i32) (result i32) local.get 0 call 0))
const bytes = new Uint8Array([
    0, 97, 115, 109, 1, 0, 0, 0, 1, 6, 1, 96, 1, 127, 1, 127, 2, 10, 1, 3, 101, 110, 118, 2, 99, 98, 0, 0,
    3, 2, 1, 0, 7, 7, 1, 3, 114, 117, 110, 0, 1, 10, 8, 1, 6, 0, 32, 0, 16, 0, 11,
]);

for (let k = 0; k < 60; k++) {
    let mod = new WebAssembly.Module(bytes);
    let inst;

    inst = new WebAssembly.Instance(mod, { env: { cb: x => (inst.exports, mod, x) } });

    assert.eq(inst.exports.run(k), k);

    mod = undefined;
    inst = undefined;

    tjs.engine.gc.run();
}
