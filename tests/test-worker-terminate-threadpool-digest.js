// worker.terminate() while the worker's crypto.subtle.digest() is still running
// on the threadpool must wait for it instead of freeing the worker's runtime.

import assert from 'tjs:assert';

import { runTeardownThreadpoolChild } from './helpers/teardown-threadpool-run.js';

const { status, stdout, stderr } = await runTeardownThreadpoolChild('worker-terminate-threadpool.js', 'digest');

assert.eq(status.exit_status, 0, `child exited cleanly:\n${stderr}`);
assert.ok(stdout.includes('digest: ok'), `the child terminated all its workers:\n${stdout}`);
