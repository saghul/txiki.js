import assert from 'tjs:assert';
import path from 'tjs:path';


const data = await tjs.readFile(path.join(import.meta.dirname, 'wasm', 'global.wasm'));
const { instance } = await WebAssembly.instantiate(data);
const { exports } = instance;

// Exported globals should be Global instances.
assert.ok(exports.g_i32_mut instanceof WebAssembly.Global, 'mutable i32 global is a Global instance');
assert.ok(exports.g_i32_const instanceof WebAssembly.Global, 'const i32 global is a Global instance');
assert.ok(exports.g_f64_mut instanceof WebAssembly.Global, 'mutable f64 global is a Global instance');

// Read initial values via JS.
assert.eq(exports.g_i32_mut.value, 42, 'i32 mutable initial value');
assert.eq(exports.g_i32_const.value, 100, 'i32 const initial value');
assert.eq(exports.g_f32_mut.value, 1.5, 'f32 mutable initial value');
assert.eq(exports.g_f64_mut.value, 3.14, 'f64 mutable initial value');

// valueOf works.
assert.eq(exports.g_i32_mut.valueOf(), 42, 'valueOf returns value');
assert.eq(+exports.g_i32_mut, 42, 'numeric coercion via valueOf');

// Set mutable global from JS, read from WASM.
exports.g_i32_mut.value = 999;
assert.eq(exports.g_i32_mut.value, 999, 'JS set reflected in JS get');
assert.eq(exports.get_i32_mut(), 999, 'JS set reflected in WASM get');

// Set mutable global from WASM, read from JS.
exports.set_i32_mut(777);
assert.eq(exports.g_i32_mut.value, 777, 'WASM set reflected in JS get');

// Immutable global throws on set.
try {
    exports.g_i32_const.value = 1;
    assert.ok(false, 'should have thrown');
} catch (e) {
    assert.ok(e instanceof TypeError, 'setting immutable global throws TypeError');
}

// i64 global with BigInt.
const bigVal = exports.g_i64_mut.value;
assert.eq(typeof bigVal, 'bigint', 'i64 global returns BigInt');
assert.eq(bigVal, 9007199254740993n, 'i64 initial value');

exports.g_i64_mut.value = 42n;
assert.eq(exports.g_i64_mut.value, 42, 'i64 set with BigInt');
assert.eq(exports.get_i64_mut(), 42, 'i64 WASM sees BigInt set');

// i64: set with small number (auto-converted).
exports.g_i64_mut.value = 123;
assert.eq(exports.get_i64_mut(), 123, 'i64 set with small number');

// f64 mutable global.
exports.g_f64_mut.value = 2.718;
assert.eq(exports.g_f64_mut.value, 2.718, 'f64 set and get');

// Standalone Global.
const g = new WebAssembly.Global({ value: 'i32', mutable: true }, 10);
assert.eq(g.value, 10, 'standalone initial value');
g.value = 20;
assert.eq(g.value, 20, 'standalone set');

const gConst = new WebAssembly.Global({ value: 'f64' }, 3.14);
assert.eq(gConst.value, 3.14, 'standalone const initial value');
try {
    gConst.value = 1;
    assert.ok(false, 'should have thrown');
} catch (e) {
    assert.ok(e instanceof TypeError, 'standalone immutable throws TypeError');
}

// i64 standalone with default value.
const g64 = new WebAssembly.Global({ value: 'i64', mutable: true });
assert.eq(g64.value, 0n, 'i64 standalone default is 0n');
g64.value = 999n;
assert.eq(g64.value, 999n, 'i64 standalone set');

// Standalone type coercion.
const gCoerce = new WebAssembly.Global({ value: 'i32', mutable: true }, 3.7);
assert.eq(gCoerce.value, 3, 'i32 constructor truncates float');
gCoerce.value = -1.9;
assert.eq(gCoerce.value, -1, 'i32 set truncates float');

const gf32 = new WebAssembly.Global({ value: 'f32', mutable: true }, 1.1);
assert.eq(gf32.value, Math.fround(1.1), 'f32 constructor applies Math.fround');
gf32.value = 2.2;
assert.eq(gf32.value, Math.fround(2.2), 'f32 set applies Math.fround');

const gf64 = new WebAssembly.Global({ value: 'f64', mutable: true }, '42');
assert.eq(gf64.value, 42, 'f64 constructor coerces string to number');

const gi64c = new WebAssembly.Global({ value: 'i64' }, 5);
assert.eq(gi64c.value, 5n, 'i64 constructor coerces number to BigInt');

// Constructor validation.
try {
    new WebAssembly.Global();
    assert.ok(false, 'should have thrown');
} catch (e) {
    assert.ok(e instanceof TypeError, 'missing descriptor throws TypeError');
}

try {
    new WebAssembly.Global({ value: 'v128' });
    assert.ok(false, 'should have thrown');
} catch (e) {
    assert.ok(e instanceof TypeError, 'invalid type throws TypeError');
}
