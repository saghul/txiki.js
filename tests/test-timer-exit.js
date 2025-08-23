import assert from 'tjs:assert';
import path from 'tjs:path';


const args = [
    tjs.exePath,
    'run',
    path.join(import.meta.dirname, 'helpers', 'timers2.js')
];
const proc = tjs.spawn(args, { stdout: 'ignore', stderr: 'pipe' });
const status = await proc.wait();
const buf = new Uint8Array(4096);
const nread = await proc.stderr.read(buf);
const stderrStr = new TextDecoder().decode(buf.subarray(0, nread));
assert.ok(stderrStr.match(/Error: oops!/) !== null, 'dumps to stderr');
assert.ok(status.exit_status !== 0 && status.term_signal === null, 'succeeded');
