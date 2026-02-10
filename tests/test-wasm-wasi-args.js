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
const [ status, dataStr ] = await Promise.all([ proc.wait(), proc.stdout.text() ]);
assert.eq(status.exit_status, 0, 'WASI ran successfully with args');
assert.ok(dataStr.length > 0, 'stdout was read');
// Args output should include: test.wasm; arg1; arg2;
assert.ok(dataStr.match(/Args:.*test\.wasm.*arg1.*arg2/), 'args passed correctly');
