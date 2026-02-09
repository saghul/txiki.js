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
const { value } = await proc.stdout.getReader().read();
assert.ok(value.length > 0, 'stdout was read');
const dataStr = new TextDecoder().decode(value);
// Args output should include: test.wasm; arg1; arg2;
assert.ok(dataStr.match(/Args:.*test\.wasm.*arg1.*arg2/), 'args passed correctly');
