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
const [ status, stderrStr ] = await Promise.all([ proc.wait(), proc.stderr.text() ]);

// On Unix, we expect a LinkError. On Windows, WAMR crashes (bug in WAMR).
if (status.exit_status === 1) {
    // Proper error handling
    assert.ok(stderrStr.match(/LinkError/), 'invalid preopen throws LinkError');
} else {
    // Crash (Windows) - exit_status will be non-zero (negative on crash)
    assert.ok(status.exit_status !== 0, 'invalid preopen should fail');
}
