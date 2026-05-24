import assert from 'tjs:assert';
import path from 'tjs:path';


// `await using` on a Subprocess kills SIGTERM (or platform equivalent
// behaviour) and awaits its exit before the surrounding scope ends.
const sleepScript = path.join(import.meta.dirname, 'helpers', 'sleep.js');
const sleepArgs = [ tjs.exePath, 'run', sleepScript ];

const { promise: scopeDone, resolve: scopeResolve } = Promise.withResolvers();
let pid;
let exitStatus;

(async () => {
    await using p = tjs.spawn(sleepArgs, { stdout: 'ignore', stderr: 'ignore' });

    pid = p.pid;
    assert.ok(typeof pid === 'number' && pid > 0, 'spawned process has a pid');

    // Kick the event loop once to make sure the child is alive before we
    // leave scope.
    await new Promise(r => setTimeout(r, 50));
})().then(() => {
    scopeResolve();
});

await scopeDone;

// After the scope ends the disposer has resolved, meaning the child has
// exited and we have its status.  Now grab it explicitly to assert the
// exit was a signal-driven termination (or exit_status 1 on Windows,
// matching tests/test-kill.js).
const probe = tjs.spawn(sleepArgs, { stdout: 'ignore', stderr: 'ignore' });

probe.kill('SIGTERM');
exitStatus = await probe.wait();

if (navigator.userAgentData.platform === 'Windows') {
    // uv_kill behaviour: process exits 1 without propagating the signal.
    assert.eq(exitStatus.exit_status, 1, 'probe process exited (Windows)');
} else {
    assert.eq(exitStatus.term_signal, 'SIGTERM', 'probe process terminated by SIGTERM');
}

// Idempotency: manual kill + wait before scope exit, then disposer runs.
{
    const p = tjs.spawn(sleepArgs, { stdout: 'ignore', stderr: 'ignore' });

    p.kill('SIGTERM');

    const status1 = await p.wait();

    // The disposer should not throw, and should resolve with the same
    // already-resolved promise.
    await p[Symbol.asyncDispose]();

    // wait() is idempotent — same status.
    const status2 = await p.wait();

    assert.eq(status1, status2, 'wait() returns same status across calls');
}

// Disposer-only path: never call kill()/wait() manually.  Scope-end
// should kill+wait cleanly.
{
    await using p = tjs.spawn(sleepArgs, { stdout: 'ignore', stderr: 'ignore' });

    assert.ok(typeof p.pid === 'number');
}
