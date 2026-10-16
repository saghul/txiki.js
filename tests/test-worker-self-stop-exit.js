// A worker that stops itself (self.close() or an uncaught error) must release
// the parent: the parent exits once the worker is gone, after everything the
// worker posted before stopping has been delivered.
import assert from 'tjs:assert';
import path from 'tjs:path';

async function runHelper(name, ...extra) {
    const args = [ tjs.exePath, 'run', path.join(import.meta.dirname, 'helpers', name), ...extra ];
    const proc = tjs.spawn(args, { stdout: 'pipe', stderr: 'pipe' });
    let timedOut = false;
    // A hang fails here rather than at the runner's timeout; GC-stress builds are far slower.
    const watchdog = setTimeout(() => {
        timedOut = true;
        proc.kill('SIGKILL');
    }, tjs.env.TJS_GC_STRESS ? 60000 : 10000);
    const [ status, stdout ] = await Promise.all([ proc.wait(), proc.stdout.text(), proc.stderr.text() ]);

    clearTimeout(watchdog);
    assert.ok(!timedOut, `${name} ${extra.join(' ')}: parent exited (did not hang)`);

    return { status, lines: stdout.trim().split('\n') };
}

{
    const { status, lines } = await runHelper('worker-self-close-exit.js');

    assert.eq(status.exit_status, 0, 'self.close(): exits cleanly');
    assert.equal(lines, [ 'got bye' ], 'self.close(): message posted before close() delivered');
}

{
    const { status, lines } = await runHelper('worker-uncaught-exit.js');

    assert.eq(status.exit_status, 0, 'uncaught error: exits cleanly');
    assert.equal(lines, [ 'got hi', 'error boom' ], 'uncaught error: message and error delivered');
}

{
    const { status, lines } = await runHelper('worker-self-close-exit.js', '--post-after');

    assert.eq(status.exit_status, 0, 'postMessage after self.close(): exits cleanly');
    assert.equal(lines, [ 'got bye', 'posted after close' ], 'postMessage after self.close() does not throw');
}
