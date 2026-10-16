import assert from 'tjs:assert';
import path from 'tjs:path';


const args = [
    tjs.exePath,
    'run',
    path.join(import.meta.dirname, 'helpers', 'unhandled-rejection-event-ctor-throws.js')
];
const proc = tjs.spawn(args, { stdout: 'ignore', stderr: 'pipe' });
const [ status, stderrStr ] = await Promise.all([ proc.wait(), proc.stderr.text() ]);

assert.ok(status.exit_status !== 0, 'exits with an error');
assert.eq(status.term_signal, null, 'is not killed by a signal');
assert.ok(/ctor-throws/.test(stderrStr), 'dumps the rejection reason to stderr');
assert.ok(!stderrStr.includes('Assertion'), 'does not hit an assertion');
