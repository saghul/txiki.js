// Exiting on an uncaught error while JS keeps queueing threadpool work from each
// completion (a `for (;;) await crypto.subtle.digest()` loop) must still finish:
// teardown waits for the work in flight, but not for work queued forever.

import assert from 'tjs:assert';

import { runTeardownThreadpoolChild } from './helpers/teardown-threadpool-run.js';

const { status, stderr } = await runTeardownThreadpoolChild('teardown-threadpool-digest-loop.js');

assert.eq(status.exit_status, 1, `child exited with the uncaught error status:\n${stderr}`);
assert.ok(stderr.includes('teardown with a digest loop running'), `the child reported its error:\n${stderr}`);
