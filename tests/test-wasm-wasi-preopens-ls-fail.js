import assert from 'tjs:assert';
import path from 'tjs:path';

// Test that ls fails properly when directory doesn't exist
// Run in subprocess to isolate WAMR cleanup issues on error path
const wasiDir = path.join(import.meta.dirname, 'wasi');
const wasmFile = path.join(wasiDir, 'test.wasm');
const testScript = path.join(import.meta.dirname, 'helpers', 'wasi-ls-fail.js');
const args = [
    tjs.exePath,
    'run',
    testScript,
    wasmFile,
    wasiDir
];
const proc = tjs.spawn(args, { stdout: 'pipe', stderr: 'pipe' });
const status = await proc.wait();

// Should exit with error (RuntimeError when WASM program exits with non-zero)
assert.ok(status.exit_status !== 0, 'WASI ls of nonexistent dir should fail');

// Read stderr for error message
const { value } = await proc.stderr.getReader().read();
const stderrStr = value ? new TextDecoder().decode(value) : '';

assert.ok(stderrStr.match(/Cannot open|RuntimeError/), 'error message indicates failure');
