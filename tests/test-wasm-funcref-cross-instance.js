// A funcref is only meaningful within its own module instance (WAMR non-GC
// represents it as an instance-local function index). Storing a funcref that
// belongs to a different instance must be rejected rather than silently calling
// the wrong function.

import assert from 'tjs:assert';
import globalData from './wasm/funcref-global.wasm' with { type: 'bytes' };
import tableData from './wasm/table.wasm' with { type: 'bytes' };

// --- funcref globals ---
{
    const { instance: a } = await WebAssembly.instantiate(globalData);
    const { instance: b } = await WebAssembly.instantiate(globalData);

    // A funcref from instance b cannot be stored into instance a's global.
    try {
        a.exports.g_func.value = b.exports.ret7;
        assert.ok(false, 'storing a cross-instance funcref global should throw');
    } catch (e) {
        assert.ok(e instanceof TypeError, 'cross-instance funcref global set throws TypeError');
    }

    // Same-instance funcref still works.
    a.exports.g_func.value = a.exports.ret7;
    assert.eq(a.exports.g_func.value(), 7, 'same-instance funcref global set works');
}

// --- funcref tables ---
{
    const { instance: a } = await WebAssembly.instantiate(tableData);
    const { instance: b } = await WebAssembly.instantiate(tableData);

    // A funcref from instance b cannot be stored into instance a's table.
    try {
        a.exports.tbl.set(3, b.exports.add);
        assert.ok(false, 'storing a cross-instance funcref into a table should throw');
    } catch (e) {
        assert.ok(e instanceof TypeError, 'cross-instance table.set throws TypeError');
    }

    // Same-instance funcref still works.
    a.exports.tbl.set(3, a.exports.add);
    assert.eq(a.exports.call_indirect(3, 100, 200), 300, 'same-instance table.set works');
}
