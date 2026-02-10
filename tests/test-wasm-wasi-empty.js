import assert from 'tjs:assert';
import path from 'tjs:path';

const args = [
    tjs.exePath,
    'run',
    path.join(import.meta.dirname, 'wasi', 'empty.wasm')
];
const proc = tjs.spawn(args, { stderr: 'pipe' });
const [ status, dataStr ] = await Promise.all([ proc.wait(), proc.stderr.text() ]);
assert.eq(status.exit_status, 1, 'WASI failed to run');
assert.ok(dataStr.length > 0, 'stderr was read');
assert.ok(dataStr.match(/TypeError: invalid buffer/));
