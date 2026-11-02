// HTTP/2: aborting a fetch while its new connection is still connecting or
// negotiating ALPN must not keep the event loop alive, so the process exits
// once the script is done. Fixed by the lws v5.1.0 bump (#1198).
import assert from 'tjs:assert';
import path from 'tjs:path';

const args = [ tjs.exePath, 'run', path.join(import.meta.dirname, 'helpers', 'fetch-h2-abort-opener.js') ];
const proc = tjs.spawn(args, { stdout: 'pipe', stderr: 'pipe' });
let timedOut = false;
// A hang fails here rather than at the runner's timeout; GC-stress builds are far slower.
const watchdog = setTimeout(() => {
    timedOut = true;
    proc.kill('SIGKILL');
}, tjs.env.TJS_GC_STRESS ? 60000 : 10000);
const [ status, stdout, stderr ] = await Promise.all([ proc.wait(), proc.stdout.text(), proc.stderr.text() ]);

clearTimeout(watchdog);

const output = `stdout:\n${stdout}\nstderr:\n${stderr}`;

assert.ok(!timedOut, `the process exited (did not hang)\n${output}`);
assert.eq(status.exit_status, 0, `the process exited cleanly\n${output}`);
assert.ok(stdout.trim().endsWith('loop done'), `the sweep completed\n${output}`);
