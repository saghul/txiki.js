// funcref values have a stable JS identity: reading the same funcref twice
// returns the same object, and a funcref to an exported function is the very
// object exposed on instance.exports (matching V8 / the JS-API).

import assert from 'tjs:assert';
import globalData from './wasm/funcref-global.wasm' with { type: 'bytes' };
import tableData from './wasm/table.wasm' with { type: 'bytes' };

// --- funcref globals ---
{
    const { instance } = await WebAssembly.instantiate(globalData);
    const { exports } = instance;
    const g = exports.g_func;

    // Repeated reads return the same wrapper.
    assert.ok(g.value === g.value, 'funcref global read is identity-stable');

    // g_func is initialised to ref.func $ret42, which is exported as "ret42".
    assert.ok(g.value === exports.ret42, 'funcref global === the exported function it points at');
    assert.eq(g.value(), 42, 'the shared wrapper is callable');

    // Assigning an export makes reads return that very export.
    g.value = exports.ret7;
    assert.ok(g.value === exports.ret7, 'after set, funcref global === the assigned export');
    assert.eq(g.value(), 7, 'reassigned funcref is callable');
}

// --- funcref tables ---
{
    const { instance } = await WebAssembly.instantiate(tableData);
    const { exports } = instance;
    const tbl = exports.tbl;

    // tbl[0] is $add, exported as "add".
    assert.ok(tbl.get(0) === tbl.get(0), 'funcref table read is identity-stable');
    assert.ok(tbl.get(0) === exports.add, 'table funcref === the exported function');

    // tbl[2] is $mul, which is NOT exported: still identity-stable across reads.
    assert.ok(tbl.get(2) === tbl.get(2), 'non-exported table funcref is identity-stable');
    assert.eq(tbl.get(2)(5, 6), 30, 'non-exported table funcref is callable');

    // Storing an export and reading it back yields the same object.
    tbl.set(3, exports.sub);
    assert.ok(tbl.get(3) === exports.sub, 'stored export reads back as the same object');
}
