import assert from 'tjs:assert';
import path from 'tjs:path';

const args = [
    tjs.exePath,
    'run',
    path.join(import.meta.dirname, 'wasi', 'test.wasm'),
    'arg1',
    'arg2'
];
const proc = tjs.spawn(args, { stdout: 'pipe' });
const status = await proc.wait();
assert.eq(status.exit_status, 0, 'WASI ran successfully with args');
const buf = new Uint8Array(4096);
const nread = await proc.stdout.read(buf);
assert.ok(nread > 0, 'stdout was read');
const dataStr = new TextDecoder().decode(buf.subarray(0, nread));
// Args output should include: test.wasm; arg1; arg2;
assert.ok(dataStr.match(/Args:.*test\.wasm.*arg1.*arg2/), 'args passed correctly');
