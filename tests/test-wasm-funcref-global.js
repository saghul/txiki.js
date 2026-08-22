// funcref-typed exported globals: reading returns a callable (or null) and
// writing accepts a WebAssembly function (or null), round-tripping through the
// underlying WAMR global.

import assert from 'tjs:assert';
import data from './wasm/funcref-global.wasm' with { type: 'bytes' };

const { instance } = await WebAssembly.instantiate(data);
const { exports } = instance;

const g = exports.g_func;
assert.ok(g instanceof WebAssembly.Global, 'g_func is a Global');

// Initialised to ref.func $ret42.
const f = g.value;
assert.ok(typeof f === 'function', 'funcref global reads back as a callable');
assert.eq(f(), 42, 'funcref global points at ret42');

// Initialised to ref.null func.
assert.eq(exports.g_null.value, null, 'null funcref global reads back as null');

// Set to another exported function and read it back.
g.value = exports.ret7;
assert.eq(g.value(), 7, 'funcref global set to ret7 round-trips');

// Set back to null.
g.value = null;
assert.eq(g.value, null, 'funcref global set to null reads back null');

// A non-function, non-null value is rejected.
try {
    g.value = 123;
    assert.ok(false, 'setting a funcref global to a non-function should throw');
} catch (e) {
    assert.ok(e instanceof TypeError, 'funcref global set rejects non-function values');
}
