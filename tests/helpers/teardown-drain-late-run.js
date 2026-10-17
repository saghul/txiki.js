// Shared body of the test-teardown-drain-late-*.js tests: JS that runs during
// the teardown drain (a canceled write's rejection handler) creates a resource
// after its teardown step already ran. Teardown must still release it, or a
// Debug build aborts at exit (Object leaks + JS_FreeRuntime assertion).

import assert from 'tjs:assert';
import path from 'tjs:path';

// Fail with a clear message well before the runner's 30 s timeout.
const TIMEOUT = 20000;

export async function runTeardownDrainLateTest(variant, extraMarker) {
    const args = [
        tjs.exePath,
        'run',
        path.join(import.meta.dirname, 'teardown-drain-late.js'),
        variant
    ];
    const proc = tjs.spawn(args, { stdout: 'ignore', stderr: 'pipe' });

    let timer;
    const expired = new Promise(resolve => {
        timer = setTimeout(resolve, TIMEOUT);
    });
    const result = await Promise.race([ Promise.all([ proc.wait(), proc.stderr.text() ]), expired ]);

    clearTimeout(timer);

    if (!result) {
        proc.kill('SIGKILL');
        await proc.wait();
        assert.fail(`child (${variant}) did not exit within ${TIMEOUT} ms: teardown hung`);
    }

    const [ status, stderrStr ] = result;

    assert.ok(stderrStr.includes(`late ${variant} issued during the teardown drain`),
        `the drain-time handler ran in the child:\n${stderrStr}`);

    if (extraMarker) {
        assert.ok(stderrStr.includes(extraMarker), `the child printed "${extraMarker}":\n${stderrStr}`);
    }

    assert.eq(status.term_signal, null, `child was not killed by a signal (no abort on teardown):\n${stderrStr}`);
    assert.ok(status.exit_status !== 0, 'child exited non-zero');
}
