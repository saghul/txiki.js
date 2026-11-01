// worker.terminate() while the worker keeps queueing a new digest from each
// one's continuation must still reap the worker.

import assert from 'tjs:assert';

import { runTeardownThreadpoolChild } from './helpers/teardown-threadpool-run.js';

const { status, stdout, stderr } = await runTeardownThreadpoolChild('worker-terminate-threadpool.js', 'digest-loop');

assert.eq(status.exit_status, 0, `child exited cleanly:\n${stderr}`);
assert.ok(stdout.includes('digest-loop: ok'), `the child terminated all its workers:\n${stdout}`);
