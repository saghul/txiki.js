import assert from 'tjs:assert';


assert.ok(tjs.version, 'tjs.version is defined');
assert.ok(tjs.engine.versions, 'tjs.versions is defined');
assert.ok(tjs.engine.versions.tjs, 'tjs is defined');
assert.ok(tjs.engine.versions.curl, 'curl is defined');
assert.ok(tjs.engine.versions.quickjs, 'quickjs is defined');
assert.ok(tjs.engine.versions.uv, 'uv is defined');
assert.ok(tjs.engine.versions.sqlite3, 'sqlite3 is defined');
assert.ok(tjs.engine.versions.wasm3, 'wasm3 is defined');
