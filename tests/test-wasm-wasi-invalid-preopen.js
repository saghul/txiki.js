import assert from 'tjs:assert';
import path from 'tjs:path';

// Test that invalid preopens fail gracefully during instance creation
// Run in subprocess because WAMR crashes on Windows instead of returning an error
const wasmFile = path.join(import.meta.dirname, 'wasi', 'test.wasm');
const testScript = path.join(import.meta.dirname, 'helpers', 'wasi-invalid-preopen.js');
const args = [
    tjs.exePath,
    'run',
    testScript,
    wasmFile
];
const proc = tjs.spawn(args, { stdout: 'pipe', stderr: 'pipe' });
const status = await proc.wait();

// Read stderr for error message
const buf = new Uint8Array(4096);
const nread = await proc.stderr.read(buf);
const stderrStr = nread > 0 ? new TextDecoder().decode(buf.subarray(0, nread)) : '';

// On Unix, we expect a LinkError. On Windows, WAMR crashes (bug in WAMR).
if (status.exit_status === 1) {
    // Proper error handling
    assert.ok(stderrStr.match(/LinkError/), 'invalid preopen throws LinkError');
} else {
    // Crash (Windows) - exit_status will be non-zero (negative on crash)
    assert.ok(status.exit_status !== 0, 'invalid preopen should fail');
}
