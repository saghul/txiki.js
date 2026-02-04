import assert from 'tjs:assert';
import path from 'tjs:path';
import { WASI } from 'tjs:wasi';

// Test directory listing via preopens using direct API
const wasiDir = path.join(import.meta.dirname, 'wasi');
const bytes = await tjs.readFile(path.join(wasiDir, 'test.wasm'));
const module = new WebAssembly.Module(bytes);

const wasi = new WASI({
    version: 'wasi_snapshot_preview1',
    args: [ 'test.wasm', 'ls', wasiDir ],
    preopens: { [wasiDir]: wasiDir }
});
const instance = new WebAssembly.Instance(module, wasi.getImportObject());

// Run the WASI instance - should complete without error
wasi.start(instance);
// If we get here without throwing, the ls command worked
