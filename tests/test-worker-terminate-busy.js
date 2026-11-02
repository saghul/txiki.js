// terminate() aborts a worker stuck in synchronous JS instead of blocking the
// parent forever, and the abort is silent: no error event and nothing on stderr.
// An uncaught error in the parent tears a busy worker down the same way. JS that
// the teardown drain runs (on the parent thread) is aborted too, whether the
// worker was terminated or closed itself.
import assert from 'tjs:assert';
import path from 'tjs:path';

async function runHelper(mode) {
    const args = [ tjs.exePath, 'run', path.join(import.meta.dirname, 'helpers', 'worker-terminate-busy.js'), mode ];
    const proc = tjs.spawn(args, { stdout: 'pipe', stderr: 'pipe' });
    let timedOut = false;
    // A hang fails here rather than at the runner's timeout; GC-stress builds are far slower.
    const watchdog = setTimeout(() => {
        timedOut = true;
        proc.kill('SIGKILL');
    }, tjs.env.TJS_GC_STRESS ? 60000 : 10000);
    const [ status, stdout, stderr ] = await Promise.all([ proc.wait(), proc.stdout.text(), proc.stderr.text() ]);

    clearTimeout(watchdog);
    assert.ok(!timedOut, `${mode}: parent exited (did not hang)`);

    return { status, stdout: stdout.trim(), stderr };
}

for (const mode of [ 'top-level', 'onmessage', 'await', 'drain-terminate' ]) {
    const { status, stdout, stderr } = await runHelper(mode);

    assert.eq(status.exit_status, 0, `${mode}: exits cleanly`);
    assert.eq(stdout, 'terminate returned', `${mode}: terminate() returned, no error event`);
    assert.eq(stderr, '', `${mode}: nothing on stderr`);
}

{
    const { status, stdout, stderr } = await runHelper('drain-close');

    assert.eq(status.exit_status, 0, 'drain-close: exits cleanly');
    assert.eq(stdout, 'parent alive', 'drain-close: parent loop kept running, no error event');
    assert.eq(stderr, '', 'drain-close: nothing on stderr');
}

{
    const { status, stdout, stderr } = await runHelper('parent-throw');

    assert.eq(status.exit_status, 1, 'parent-throw: exits with the error status');
    assert.eq(stdout, '', 'parent-throw: no error event');
    assert.ok(stderr.includes('boom'), 'parent-throw: parent error reported');
    assert.ok(!stderr.includes('interrupted'), 'parent-throw: worker abort is silent');
}
