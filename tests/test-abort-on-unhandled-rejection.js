import assert from 'tjs:assert';
import path from 'tjs:path';


const args = [
    tjs.exepath,
    'run',
    path.join(import.meta.dirname, 'helpers', 'unhandled-rejection.js')
];
const proc = tjs.spawn(args, { stdout: 'ignore', stderr: 'pipe' });
const buf = new Uint8Array(4096);
const nread = await proc.stderr.read(buf);
const stderrStr = new TextDecoder().decode(buf.subarray(0, nread));
const status = await proc.wait();
assert.ok(stderrStr.match(/Error: oops!/) !== null, 'dumps to stderr');
assert.ok(status.exit_status !== 0 && status.term_signal === null, 'succeeded');
