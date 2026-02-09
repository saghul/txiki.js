import assert from 'tjs:assert';
import path from 'tjs:path';
import { slurpStdio } from './helpers.js';

// Test that preopens work by having WASM read a file
const testFile = path.join(import.meta.dirname, 'wasi', 'testfile.txt');
const testContent = 'Hello from preopen test!\n';

const f = await tjs.open(testFile, 'w');

await f.write(new TextEncoder().encode(testContent));
await f.close();

try {
    // Spawn subprocess so we can capture stdout
    const args = [
        tjs.exePath,
        'run',
        path.join(import.meta.dirname, 'wasi', 'test.wasm'),
        'cat',
        testFile
    ];
    const proc = tjs.spawn(args, { stdout: 'pipe', stderr: 'pipe' });
    const status = await proc.wait();
    const dataStr = await slurpStdio(proc.stdout);

    assert.ok(dataStr.length > 0, 'stdout was read for cat');

    // "Hello from preopen test!\n" in hex is:
    // 48 65 6c 6c 6f 20 66 72 6f 6d 20 70 72 65 6f 70 65 6e 20 74 65 73 74 21 0a
    assert.ok(dataStr.match(/48 65 6c 6c 6f/), 'file content starts with "Hello" in hex');
    assert.ok(dataStr.match(/=== done ===/), 'WASI completed successfully');
    assert.eq(status.exit_status, 0, 'WASI cat exited with 0');
} finally {
    await tjs.remove(testFile);
}
