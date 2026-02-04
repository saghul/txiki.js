import assert from 'tjs:assert';
import path from 'tjs:path';
import { WASI } from 'tjs:wasi';

// Test getImportObject() helper
const bytes = await tjs.readFile(path.join(import.meta.dirname, 'wasi', 'test.wasm'));
const module = new WebAssembly.Module(bytes);
const wasiDir = path.join(import.meta.dirname, 'wasi');
const wasi = new WASI({
    version: 'wasi_snapshot_preview1',
    args: [ 'test.wasm', 'testarg' ],
    env: { TEST_VAR: 'test_value' },
    preopens: { [wasiDir]: wasiDir }
});

// Test that getImportObject() returns proper structure
const importObject = wasi.getImportObject();
assert.ok(importObject.wasi_snapshot_preview1, 'getImportObject returns wasi_snapshot_preview1');
assert.eq(importObject.wasi_snapshot_preview1, wasi.wasiImport, 'namespace equals wasiImport');

const instance = new WebAssembly.Instance(module, importObject);
assert.ok(instance.exports._start, 'WASI instance has _start');
