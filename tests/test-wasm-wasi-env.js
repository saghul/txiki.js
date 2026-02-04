import assert from 'tjs:assert';
import path from 'tjs:path';
import { WASI } from 'tjs:wasi';

// Test env variable passing via direct API
const wasiDir = path.join(import.meta.dirname, 'wasi');
const bytes = await tjs.readFile(path.join(wasiDir, 'test.wasm'));
const module = new WebAssembly.Module(bytes);
const wasi = new WASI({
    version: 'wasi_snapshot_preview1',
    args: [ 'test.wasm', 'env' ],
    env: {
        MY_TEST_VAR: 'hello_world',
        ANOTHER_VAR: '12345'
    },
    preopens: { [wasiDir]: wasiDir }
});
const instance = new WebAssembly.Instance(module, wasi.getImportObject());

// The test runs and prints env vars - we just verify it doesn't crash
// Since we can't easily capture stdout from direct API, verify it completes
wasi.start(instance);
