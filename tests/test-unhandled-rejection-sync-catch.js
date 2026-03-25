import assert from 'tjs:assert';
import path from 'tjs:path';

// Test 1: Synchronously-caught rejections must NOT fire unhandledrejection.
const syncCatchArgs = [
    tjs.exePath,
    'run',
    path.join(import.meta.dirname, 'helpers', 'sync-catch-rejection.js')
];
const syncProc = tjs.spawn(syncCatchArgs, { stdout: 'pipe', stderr: 'pipe' });
const [ syncStatus, syncOut ] = await Promise.all([ syncProc.wait(), syncProc.stdout.text() ]);
assert.eq(syncStatus.exit_status, 0, 'sync-caught rejection should not cause exit');
assert.ok(syncOut.trim() === 'OK', 'sync-caught rejection helper should print OK');

// Test 2: Genuinely unhandled rejections must still abort.
const unhandledArgs = [
    tjs.exePath,
    'run',
    path.join(import.meta.dirname, 'helpers', 'unhandled-rejection.js')
];
const unhandledProc = tjs.spawn(unhandledArgs, { stdout: 'ignore', stderr: 'pipe' });
const [ unhandledStatus, stderrStr ] = await Promise.all([ unhandledProc.wait(), unhandledProc.stderr.text() ]);
assert.ok(stderrStr.match(/Error: oops!/) !== null, 'dumps to stderr');
assert.ok(unhandledStatus.exit_status !== 0, 'unhandled rejection should cause non-zero exit');
