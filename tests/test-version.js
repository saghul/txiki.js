import assert from 'tjs:assert';


assert.ok(tjs.version, 'tjs.version is defined');
assert.ok(tjs.engine.versions, 'tjs.versions is defined');
assert.ok(tjs.engine.versions.tjs, 'tjs is defined');
assert.ok(tjs.engine.versions.lws, 'lws is defined');
assert.ok(tjs.engine.versions.quickjs, 'quickjs is defined');
assert.ok(tjs.engine.versions.uv, 'uv is defined');
assert.ok(typeof tjs.engine.features.wasm === 'boolean', 'features.wasm is boolean');
assert.ok(typeof tjs.engine.features.sqlite === 'boolean', 'features.sqlite is boolean');
assert.ok(typeof tjs.engine.features.tls === 'boolean', 'features.tls is boolean');
if (tjs.engine.features.sqlite) {
    assert.ok(tjs.engine.versions.sqlite3, 'sqlite3 is defined');
}
if (tjs.engine.features.wasm) {
    assert.ok(tjs.engine.versions.wamr, 'wamr is defined');
}
