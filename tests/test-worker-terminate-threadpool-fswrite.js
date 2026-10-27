// worker.terminate() while the worker's file write is still running on the
// threadpool must wait for it instead of freeing the worker's runtime.

import assert from 'tjs:assert';
import path from 'tjs:path';

import { runTeardownThreadpoolChild } from './helpers/teardown-threadpool-run.js';

const dir = await tjs.makeTempDir(path.join(tjs.tmpDir, 'tjs-test-terminate-fswrite-XXXXXX'));

try {
    const { status, stdout, stderr } = await runTeardownThreadpoolChild('worker-terminate-threadpool.js', 'fswrite', dir);

    assert.eq(status.exit_status, 0, `child exited cleanly:\n${stderr}`);
    assert.ok(stdout.includes('fswrite: ok'), `the child terminated all its workers:\n${stdout}`);
} finally {
    await tjs.remove(dir, { recursive: true });
}
