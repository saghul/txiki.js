// A single wasm function exported under multiple names has one shared JS
// identity: the two export names, a funcref global pointing at it, and a table
// slot holding it are all the same object (matching V8 / the JS-API).

import assert from 'tjs:assert';
import data from './wasm/funcref-alias.wasm' with { type: 'bytes' };

const { instance } = await WebAssembly.instantiate(data);
const { exports } = instance;

assert.ok(exports.name1 === exports.name2, 'two export names of one function are the same object');
assert.ok(exports.g.value === exports.name1, 'funcref global === the (aliased) export');
assert.ok(exports.tbl.get(0) === exports.name1, 'table funcref === the (aliased) export');
assert.eq(exports.name2(), 77, 'aliased export is callable');

// Round-trip the second name through the global: still one identity.
exports.g.value = exports.name2;
assert.ok(exports.g.value === exports.name2, 'stored export reads back as the same object');
assert.ok(exports.g.value === exports.name1, 'and still === the first name (one identity)');
