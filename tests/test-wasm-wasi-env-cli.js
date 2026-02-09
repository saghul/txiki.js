import assert from 'tjs:assert';
import path from 'tjs:path';
import { slurpStdio } from './helpers.js';

// Test env printing via CLI (can capture output)
// Note: CLI doesn't pass env vars currently, but test.c should at least run
const args = [
    tjs.exePath,
    'run',
    path.join(import.meta.dirname, 'wasi', 'test.wasm'),
    'env'
];
const proc = tjs.spawn(args, { stdout: 'pipe' });
const status = await proc.wait();
const dataStr = await slurpStdio(proc.stdout);

assert.eq(status.exit_status, 0, 'WASI env command ran successfully');
assert.ok(dataStr.length > 0, 'stdout was read for env');
assert.ok(dataStr.match(/Env:/), 'env output contains Env: header');
assert.ok(dataStr.match(/=== done ===/), 'WASI completed successfully');
