import assert from 'tjs:assert';
import path from 'tjs:path';

// Regression test: a spawn that failed (e.g. ENOENT) used to free the process
// handle while libuv still had it registered, causing a use-after-free on
// runtime teardown. The child must exit cleanly, not be killed by a signal.
const args = [
    tjs.exePath,
    'run',
    path.join(import.meta.dirname, 'helpers', 'spawn-missing-executable.js')
];
const proc = tjs.spawn(args, { stdout: 'pipe', stderr: 'pipe' });
const [ status, stdoutStr, stderrStr ] = await Promise.all([ proc.wait(), proc.stdout.text(), proc.stderr.text() ]);

assert.ok(stdoutStr.includes('spawn failed with ENOENT'), `child printed the marker (stderr: ${stderrStr})`);
assert.eq(status.exit_status, 0, `child exited cleanly (stderr: ${stderrStr})`);
assert.eq(status.term_signal, null, 'child was not killed by a signal (no crash on teardown)');
