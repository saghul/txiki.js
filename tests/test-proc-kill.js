import assert from 'tjs:assert';
import path from 'tjs:path';


const args = [
    tjs.exepath,
    'run',
    path.join(import.meta.dirname, 'helpers', 'sleep.js')
];
const proc = tjs.spawn(args, { stdout: 'ignore', stderr: 'ignore' });
proc.kill('SIGKILL');
const status = await proc.wait();
assert.eq(status.term_signal, 'SIGKILL');
