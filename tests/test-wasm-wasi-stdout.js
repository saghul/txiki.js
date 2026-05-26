import assert from 'tjs:assert';
import path from 'tjs:path';
import { WASI } from 'tjs:wasi';

import bytes from './wasi/test.wasm' with { type: 'bytes' };

const tmpDir = await tjs.makeTempDir('test-wasi-stdout-XXXXXX');

try {
    const outPath = path.join(tmpDir, 'out.txt');
    const f = await tjs.open(outPath, 'w');

    const module = new WebAssembly.Module(bytes);
    const wasi = new WASI({
        version: 'wasi_snapshot_preview1',
        args: [ 'test.wasm' ],
        stdout: f.fileno()
    });
    const instance = new WebAssembly.Instance(module, wasi.getImportObject());

    const code = wasi.start(instance);
    await f.close();

    assert.eq(code, 0, 'clean exit returns 0');

    const captured = new TextDecoder().decode(await tjs.readFile(outPath));
    assert.ok(captured.match(/Hello world/), 'stdout redirected to fd: test_write');
    assert.ok(captured.match(/Hello printf!/), 'stdout redirected to fd: test_printf');
    assert.ok(captured.match(/=== done ===/), 'stdout redirected to fd: main completed');
} finally {
    await tjs.remove(tmpDir);
}
