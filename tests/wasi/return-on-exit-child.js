// Helper for test-wasm-wasi-return-on-exit.js.
// Runs test.wasm with returnOnExit:false and cat-fail args so the embedder
// itself exits with the WASI exit code (1). Not a test file by itself.
import { WASI } from 'tjs:wasi';

const wasmPath = tjs.args[2];
const bytes = await tjs.readFile(wasmPath);

// stdout/stderr left at defaults (inherit the embedder's); we only care about
// the process exit code.
const module = new WebAssembly.Module(bytes);
const wasi = new WASI({
    version: 'wasi_snapshot_preview1',
    args: [ 'test.wasm', 'cat', '/nonexistent' ],
    returnOnExit: false
});
const instance = new WebAssembly.Instance(module, wasi.getImportObject());

wasi.start(instance);

// Should be unreachable: returnOnExit:false must terminate the process.
tjs.exit(123);
