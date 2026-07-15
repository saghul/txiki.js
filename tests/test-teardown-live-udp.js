import assert from 'tjs:assert';
import path from 'tjs:path';

// Regression test: an uncaught top-level exception with a live udp handle
// used to leave the handle open and crash (UAF) on runtime teardown. The child
// must exit via the uncaught error, not be killed by a signal.
const args = [
    tjs.exePath,
    'run',
    path.join(import.meta.dirname, 'helpers', 'teardown-live-udp.js')
];
const proc = tjs.spawn(args, { stdout: 'ignore', stderr: 'pipe' });
const [ status, stderrStr ] = await Promise.all([ proc.wait(), proc.stderr.text() ]);
assert.ok(stderrStr.includes('uncaught with a live udp recv'), 'child threw the expected error');
assert.ok(status.exit_status !== 0, 'child exited non-zero');
assert.eq(status.term_signal, null, 'child was not killed by a signal (no crash on teardown)');
