import assert from 'tjs:assert';
import path from 'tjs:path';
import { WASI } from 'tjs:wasi';

import bytes from './wasi/test.wasm' with { type: 'bytes' };

const wasiDir = path.join(import.meta.dirname, 'wasi');

// returnOnExit defaults to true: proc_exit(N) is reported as the return value.
const tmpDir = await tjs.makeTempDir('test-wasi-roe-XXXXXX');

try {
    // Clean exit (main returns 0) -> start() returns 0. Redirect stdout so the
    // wasm's chatter doesn't pollute the test output.
    {
        const out = await tjs.open(path.join(tmpDir, 'out.txt'), 'w');
        const module = new WebAssembly.Module(bytes);
        const wasi = new WASI({
            version: 'wasi_snapshot_preview1',
            args: [ 'test.wasm' ],
            stdout: out.fileno(),
            stderr: out.fileno()
        });
        const instance = new WebAssembly.Instance(module, wasi.getImportObject());

        assert.eq(wasi.start(instance), 0, 'clean exit returns 0');
        await out.close();
    }

    // Non-zero exit (cat failure -> main returns 1 -> proc_exit(1)).
    {
        const out = await tjs.open(path.join(tmpDir, 'out2.txt'), 'w');
        const module = new WebAssembly.Module(bytes);
        const wasi = new WASI({
            version: 'wasi_snapshot_preview1',
            args: [ 'test.wasm', 'cat', '/nonexistent' ],
            stdout: out.fileno(),
            stderr: out.fileno()
        });
        const instance = new WebAssembly.Instance(module, wasi.getImportObject());

        assert.eq(wasi.start(instance), 1, 'proc_exit code is returned');

        // start() must not run twice.
        assert.throws(() => wasi.start(instance), Error, 'second start throws');
        await out.close();
    }
} finally {
    await tjs.remove(tmpDir);
}

// returnOnExit:false terminates the embedder with the WASI exit code. Run a
// child process that sets returnOnExit:false and verify its exit status.
{
    const child = path.join(wasiDir, 'return-on-exit-child.js');
    const wasm = path.join(wasiDir, 'test.wasm');
    const proc = tjs.spawn([ tjs.exePath, 'run', child, wasm ], { stdout: 'ignore', stderr: 'ignore' });
    const status = await proc.wait();

    assert.eq(status.exit_status, 1, 'returnOnExit:false exits the process with the WASI code');
    assert.eq(status.term_signal, null, 'process exited normally, not via signal');
}
