import assert from 'tjs:assert';
import data from './wasm/table.wasm' with { type: 'bytes' };


const { instance } = await WebAssembly.instantiate(data);
const { exports } = instance;

// Table export exists.
assert.ok(exports.tbl instanceof WebAssembly.Table, 'table export is a Table');

// Table length.
assert.eq(exports.tbl.length, 4, 'table has 4 elements');

// Table.get returns callable functions.
const add = exports.tbl.get(0);
const sub = exports.tbl.get(1);
const mul = exports.tbl.get(2);
const empty = exports.tbl.get(3);

assert.ok(typeof add === 'function', 'table[0] is a function');
assert.ok(typeof sub === 'function', 'table[1] is a function');
assert.ok(typeof mul === 'function', 'table[2] is a function');
assert.eq(empty, null, 'table[3] is null');

// Call funcref from table.
assert.eq(add(3, 4), 7, 'funcref add works');
assert.eq(sub(10, 3), 7, 'funcref sub works');
assert.eq(mul(5, 6), 30, 'funcref mul works');

// call_indirect matches table entries.
assert.eq(exports.call_indirect(0, 3, 4), 7, 'call_indirect add');
assert.eq(exports.call_indirect(1, 10, 3), 7, 'call_indirect sub');
assert.eq(exports.call_indirect(2, 5, 6), 30, 'call_indirect mul');

// Table.set with exported function.
exports.tbl.set(3, exports.add);
assert.eq(exports.call_indirect(3, 100, 200), 300, 'table.set then call_indirect');

// Table.set with null.
exports.tbl.set(3, null);
assert.eq(exports.tbl.get(3), null, 'table.set null works');

// Table.get out of bounds.
try {
    exports.tbl.get(999);
    assert.ok(false, 'should have thrown');
} catch (e) {
    assert.ok(true, 'out of bounds table.get throws');
}

// Table.grow.
const oldSize = exports.tbl.grow(2);
assert.eq(oldSize, 4, 'grow returns old size');
assert.eq(exports.tbl.length, 6, 'table grew to 6');
assert.eq(exports.tbl.get(4), null, 'new slot is null');
assert.eq(exports.tbl.get(5), null, 'new slot is null');

// Module.exports lists table.
const module = new WebAssembly.Module(data);
const moduleExports = WebAssembly.Module.exports(module);
const tblExport = moduleExports.find(e => e.name === 'tbl');
assert.ok(tblExport, 'tbl export found');
assert.eq(tblExport.kind, 'table', 'tbl is a table export');
