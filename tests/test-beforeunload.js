import assert from 'tjs:assert';
import path from 'tjs:path';


// Test 1: beforeunload fires when loop is empty
{
    const args = [
        tjs.exePath, 'run',
        path.join(import.meta.dirname, 'helpers', 'beforeunload.js')
    ];
    const proc = tjs.spawn(args, { stdout: 'pipe', stderr: 'pipe' });
    const [ status, stdout ] = await Promise.all([ proc.wait(), proc.stdout.text() ]);
    assert.eq(status.exit_status, 0, 'exits cleanly');
    assert.ok(stdout.includes('beforeunload fired'), 'event fired');
}

// Test 2: preventDefault re-enters loop
{
    const args = [
        tjs.exePath, 'run',
        path.join(import.meta.dirname, 'helpers', 'beforeunload-prevent.js')
    ];
    const proc = tjs.spawn(args, { stdout: 'pipe', stderr: 'pipe' });
    const [ status, stdout ] = await Promise.all([ proc.wait(), proc.stdout.text() ]);
    assert.eq(status.exit_status, 0, 'exits cleanly');
    assert.ok(stdout.includes('beforeunload count=1'), 'first beforeunload');
    assert.ok(stdout.includes('timer from beforeunload'), 'timer ran');
    assert.ok(stdout.includes('beforeunload count=2'), 'second beforeunload after timer');
}

// Test 3: preventDefault without new work does not infinite loop
{
    const args = [
        tjs.exePath, 'run',
        path.join(import.meta.dirname, 'helpers', 'beforeunload-prevent-no-work.js')
    ];
    const proc = tjs.spawn(args, { stdout: 'pipe', stderr: 'pipe' });
    const [ status, stdout ] = await Promise.all([ proc.wait(), proc.stdout.text() ]);
    assert.eq(status.exit_status, 0, 'exits without infinite loop');
    assert.ok(stdout.includes('prevented but no work'), 'handler ran');
}

// Test 4: onbeforeunload attribute works
{
    const args = [
        tjs.exePath, 'run',
        path.join(import.meta.dirname, 'helpers', 'beforeunload-attribute.js')
    ];
    const proc = tjs.spawn(args, { stdout: 'pipe', stderr: 'pipe' });
    const [ status, stdout ] = await Promise.all([ proc.wait(), proc.stdout.text() ]);
    assert.eq(status.exit_status, 0, 'exits cleanly');
    assert.ok(stdout.includes('onbeforeunload attribute'), 'attribute handler ran');
}
