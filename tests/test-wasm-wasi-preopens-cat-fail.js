import assert from 'tjs:assert';
import path from 'tjs:path';

// Test that cat fails properly when file doesn't exist
const args = [
    tjs.exePath,
    'run',
    path.join(import.meta.dirname, 'wasi', 'test.wasm'),
    'cat',
    '/nonexistent/file.txt'
];
const proc = tjs.spawn(args, { stdout: 'pipe', stderr: 'pipe' });
const status = await proc.wait();

// Should exit with error
assert.eq(status.exit_status, 1, 'WASI cat of nonexistent file exits with 1');

// Read stderr for error message
const { value } = await proc.stderr.getReader().read();

assert.ok(value.length > 0, 'stderr was read for failed cat');

const errStr = new TextDecoder().decode(value);

assert.ok(errStr.match(/Cannot open/), 'error message mentions cannot open');
