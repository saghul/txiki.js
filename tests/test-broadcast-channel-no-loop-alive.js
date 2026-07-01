import assert from 'tjs:assert';
import path from 'tjs:path';

// An open (never-closed) BroadcastChannel must not keep its runtime's event loop
// alive: a program that forgets to close() one must still exit instead of hanging
// (matches Node, which unrefs BroadcastChannel).

const args = [
    tjs.exePath, 'run',
    path.join(import.meta.dirname, 'helpers', 'broadcast-channel-open.js')
];
const proc = tjs.spawn(args, { stdout: 'pipe', stderr: 'pipe' });

// If the loop is (wrongly) kept alive the child hangs forever; kill it so the test
// fails fast and deterministically rather than on the outer runner timeout.
const watchdog = setTimeout(() => proc.kill('SIGKILL'), 5000);
const [ status, stdout ] = await Promise.all([ proc.wait(), proc.stdout.text() ]);
clearTimeout(watchdog);

assert.ok(stdout.includes('opened'), 'child constructed the BroadcastChannel');
assert.eq(status.term_signal, null, 'child was not killed by the watchdog (it did not hang)');
assert.eq(status.exit_status, 0, 'child exited cleanly on its own with an open BroadcastChannel');
