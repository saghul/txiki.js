import assert from 'tjs:assert';
import path from 'tjs:path';


const args = [
    tjs.exePath,
    'run',
    path.join(import.meta.dirname, 'helpers', 'timers2.js')
];
const proc = tjs.spawn(args, { stdout: 'ignore', stderr: 'pipe' });
const status = await proc.wait();
const { value } = await proc.stderr.getReader().read();
const stderrStr = new TextDecoder().decode(value);
assert.ok(stderrStr.match(/Error: oops!/) !== null, 'dumps to stderr');
assert.ok(status.exit_status !== 0 && status.term_signal === null, 'succeeded');
