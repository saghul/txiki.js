// Helper script to test ls failure handling
// Run as: tjs run wasi-ls-fail.js <wasm-file> <wasi-dir>

import { WASI } from 'tjs:wasi';

const wasmFile = tjs.args[3];
const wasiDir = tjs.args[4];

if (!wasmFile || !wasiDir) {
    console.error('Usage: tjs run wasi-ls-fail.js <wasm-file> <wasi-dir>');
    tjs.exit(2);
}

const bytes = await tjs.readFile(wasmFile);
const module = new WebAssembly.Module(bytes);

const wasi = new WASI({
    version: 'wasi_snapshot_preview1',
    args: [ 'test.wasm', 'ls', '/nonexistent/directory' ],
    preopens: { [wasiDir]: wasiDir },
    // Mirror the guest's non-zero exit code onto this process.
    returnOnExit: false
});

const instance = new WebAssembly.Instance(module, wasi.getImportObject());

wasi.start(instance);
