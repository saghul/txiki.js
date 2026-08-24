// The Global constructor and the standalone (non-instance-backed) setter
// validate that a funcref value is null or a WebAssembly function, matching
// V8 / the JS-API. externref globals accept any value.

import assert from 'tjs:assert';
import data from './wasm/funcref-global.wasm' with { type: 'bytes' };

// null and the default are accepted.
assert.eq(new WebAssembly.Global({ value: 'funcref' }).value, null, 'funcref global defaults to null');
assert.eq(new WebAssembly.Global({ value: 'funcref' }, null).value, null, 'funcref global accepts null');

// A real WebAssembly function is accepted and callable.
const { instance } = await WebAssembly.instantiate(data);
const fn = instance.exports.ret42;
const g = new WebAssembly.Global({ value: 'funcref', mutable: true }, fn);
assert.ok(g.value === fn, 'funcref global accepts a WebAssembly function');
assert.eq(g.value(), 42, 'and it is callable');

// Non-null, non-function values are rejected at construction.
for (const bad of [ 42, 'x', {}, true ]) {
    try {
        new WebAssembly.Global({ value: 'funcref' }, bad);
        assert.ok(false, `constructing a funcref global with ${typeof bad} should throw`);
    } catch (e) {
        assert.ok(e instanceof TypeError, 'funcref global constructor rejects non-function values');
    }
}

// A plain (non-WebAssembly) function is also rejected.
try {
    new WebAssembly.Global({ value: 'funcref' }, () => {});
    assert.ok(false, 'constructing a funcref global with a plain JS function should throw');
} catch (e) {
    assert.ok(e instanceof TypeError, 'funcref global constructor rejects plain JS functions');
}

// The standalone setter validates too.
g.value = null;
assert.eq(g.value, null, 'standalone funcref global can be set to null');

try {
    g.value = 123;
    assert.ok(false, 'setting a standalone funcref global to a number should throw');
} catch (e) {
    assert.ok(e instanceof TypeError, 'standalone funcref global setter rejects non-function values');
}

// externref globals still accept any value.
assert.eq(new WebAssembly.Global({ value: 'externref' }, 42).value, 42, 'externref global accepts any value');
