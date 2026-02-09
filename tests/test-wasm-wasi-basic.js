import assert from 'tjs:assert';
import path from 'tjs:path';

const args = [
    tjs.exePath,
    'run',
    path.join(import.meta.dirname, 'wasi', 'test.wasm')
];
const proc = tjs.spawn(args, { stdout: 'pipe' });
const status = await proc.wait();
assert.eq(status.exit_status, 0, 'WASI ran successfully');
assert.eq(status.term_signal, null, 'WASI ran successfully 2');
const { value } = await proc.stdout.getReader().read();
assert.ok(value.length > 0, 'stdout was read');
const dataStr = new TextDecoder().decode(value);
assert.ok(dataStr.match(/Hello world/), 'data matches 1');
assert.ok(dataStr.match(/Constructor OK/), 'data matches 2');
assert.ok(dataStr.match(/Hello printf!/), 'data matches 3');
assert.ok(dataStr.match(/fib\(20\)/), 'data matches 4');
