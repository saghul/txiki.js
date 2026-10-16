import assert from 'tjs:assert';
import path from 'tjs:path';


const args = [
    tjs.exePath,
    'run',
    path.join(import.meta.dirname, 'helpers', 'beforeunload-throwing-listener-keeps-rejection.js')
];
const proc = tjs.spawn(args, { stdout: 'ignore', stderr: 'pipe' });
const [ status, stderr ] = await Promise.all([ proc.wait(), proc.stderr.text() ]);

assert.eq(status.exit_status, 1, 'exits with an error');
assert.ok(/rejection-kept/.test(stderr), 'dumps the rejection reason to stderr');
assert.ok(!/bu-should-not-run/.test(stderr), 'the beforeunload listener does not run');
