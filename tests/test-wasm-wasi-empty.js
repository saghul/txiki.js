import assert from 'tjs:assert';
import path from 'tjs:path';

const args = [
    tjs.exePath,
    'run',
    path.join(import.meta.dirname, 'wasi', 'empty.wasm')
];
const proc = tjs.spawn(args, { stderr: 'pipe' });
const status = await proc.wait();
assert.eq(status.exit_status, 1, 'WASI failed to run');
const buf = new Uint8Array(4096);
const nread = await proc.stderr.read(buf);
assert.ok(nread > 0, 'stderr was read');
const dataStr = new TextDecoder().decode(buf.subarray(0, nread));
assert.ok(dataStr.match(/TypeError: invalid buffer/));
