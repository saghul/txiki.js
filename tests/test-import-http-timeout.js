import assert from 'tjs:assert';
import path from 'tjs:path';


const args = [
    tjs.exepath,
    'run',
    path.join(import.meta.dirname, 'helpers', 'import-http-delay.js')
];
const proc = tjs.spawn(args);
const status = await proc.wait();

assert.ok(status.exit_status === 1 && status.term_signal === null);
