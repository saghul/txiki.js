import assert from 'tjs:assert';
import path from 'tjs:path';
import { WASI } from 'tjs:wasi';

import bytes from './wasi/test.wasm' with { type: 'bytes' };

// The "stdin" mode of test.wasm reads stdin to EOF and echoes it to stdout.
const tmpDir = await tjs.makeTempDir('test-wasi-stdin-XXXXXX');

try {
    const inPath = path.join(tmpDir, 'in.txt');
    const outPath = path.join(tmpDir, 'out.txt');
    const payload = 'hello from stdin\nsecond line\n';

    await tjs.writeFile(inPath, new TextEncoder().encode(payload));

    const stdinFile = await tjs.open(inPath, 'r');
    const stdoutFile = await tjs.open(outPath, 'w');

    const module = new WebAssembly.Module(bytes);
    const wasi = new WASI({
        version: 'wasi_snapshot_preview1',
        args: [ 'test.wasm', 'stdin' ],
        stdin: stdinFile.fileno(),
        stdout: stdoutFile.fileno()
    });
    const instance = new WebAssembly.Instance(module, wasi.getImportObject());

    const code = wasi.start(instance);
    await stdinFile.close();
    await stdoutFile.close();

    assert.eq(code, 0, 'stdin echo exits cleanly');

    const captured = new TextDecoder().decode(await tjs.readFile(outPath));
    assert.eq(captured, payload, 'stdin was read from fd and echoed to stdout');
} finally {
    await tjs.remove(tmpDir);
}
