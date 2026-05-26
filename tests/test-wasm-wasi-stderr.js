import assert from 'tjs:assert';
import path from 'tjs:path';
import { WASI } from 'tjs:wasi';

import bytes from './wasi/test.wasm' with { type: 'bytes' };

// test_cat fails to open a non-preopened path and writes the error to stderr,
// then main returns 1 (proc_exit(1)).
const tmpDir = await tjs.makeTempDir('test-wasi-stderr-XXXXXX');

try {
    const outPath = path.join(tmpDir, 'out.txt');
    const errPath = path.join(tmpDir, 'err.txt');
    const out = await tjs.open(outPath, 'w');
    const err = await tjs.open(errPath, 'w');

    const module = new WebAssembly.Module(bytes);
    const wasi = new WASI({
        version: 'wasi_snapshot_preview1',
        args: [ 'test.wasm', 'cat', '/nonexistent' ],
        stdout: out.fileno(),
        stderr: err.fileno()
    });
    const instance = new WebAssembly.Instance(module, wasi.getImportObject());

    const code = wasi.start(instance);
    await out.close();
    await err.close();

    assert.eq(code, 1, 'cat failure propagates exit code 1');

    const captured = new TextDecoder().decode(await tjs.readFile(errPath));
    assert.ok(captured.match(/Cannot open \/nonexistent/), 'stderr redirected to fd');
} finally {
    await tjs.remove(tmpDir);
}
