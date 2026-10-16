import assert from 'tjs:assert';
import path from 'tjs:path';


const args = [
    tjs.exePath,
    'run',
    path.join(import.meta.dirname, 'helpers', 'beforeunload-dispatch-throws.js')
];
const proc = tjs.spawn(args, { stdout: 'ignore', stderr: 'pipe' });
const [ status, stderr ] = await Promise.all([ proc.wait(), proc.stderr.text() ]);

assert.eq(status.exit_status, 1, 'exits with an error');
assert.eq(status.term_signal, null, 'is not killed by a signal');
assert.ok(/bu-dispatch-throws/.test(stderr), 'dumps the error to stderr');
assert.eq(stderr.match(/bu-dispatch-throws/g).length, 1, 'dumps the error once');
