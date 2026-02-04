// Helper script to test invalid preopen handling
// Run as: tjs run wasi-invalid-preopen.js <path-to-wasm-file>

import { WASI } from 'tjs:wasi';

const wasmFile = tjs.args[3];

if (!wasmFile) {
    console.error('Usage: tjs run wasi-invalid-preopen.js <wasm-file>');
    tjs.exit(2);
}

const bytes = await tjs.readFile(wasmFile);
const module = new WebAssembly.Module(bytes);

const wasi = new WASI({
    version: 'wasi_snapshot_preview1',
    args: [ 'test.wasm' ],
    preopens: { '/nonexistent/path': '/nonexistent/path' }
});

// This should throw LinkError (or crash on Windows due to WAMR bug)
new WebAssembly.Instance(module, wasi.getImportObject());
