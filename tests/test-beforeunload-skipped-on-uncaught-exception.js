import assert from 'tjs:assert';
import path from 'tjs:path';


const args = [
    tjs.exePath,
    'run',
    path.join(import.meta.dirname, 'helpers', 'beforeunload-skipped-on-uncaught-exception.js')
];
const proc = tjs.spawn(args, { stdout: 'pipe', stderr: 'pipe' });
const [ status, stdout, stderr ] = await Promise.all([ proc.wait(), proc.stdout.text(), proc.stderr.text() ]);

assert.eq(status.exit_status, 1, 'exits with an error');
assert.eq(status.term_signal, null, 'is not killed by a signal');
assert.ok(/uncaught-skip-bu/.test(stderr), 'dumps the exception to stderr');
assert.ok(!stdout.includes('beforeunload fired'), 'beforeunload does not fire');
