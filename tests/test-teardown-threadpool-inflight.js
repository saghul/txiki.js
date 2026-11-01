// Exiting on an uncaught error while a digest, a file write and DNS lookups are
// still running on the threadpool must wait for them before tearing the runtime
// down (GitHub issue #1084).

import assert from 'tjs:assert';
import path from 'tjs:path';

import { runTeardownThreadpoolChild } from './helpers/teardown-threadpool-run.js';

const dir = await tjs.makeTempDir(path.join(tjs.tmpDir, 'tjs-test-teardown-inflight-XXXXXX'));

try {
    const { status, stderr } = await runTeardownThreadpoolChild('teardown-threadpool-inflight.js', dir);

    assert.eq(status.exit_status, 1, `child exited with the uncaught error status:\n${stderr}`);
    assert.ok(stderr.includes('teardown with threadpool work in flight'), `the child reported its error:\n${stderr}`);
} finally {
    await tjs.remove(dir, { recursive: true });
}
