// A synchronous exception in the entry script, thrown before the event loop ever
// runs, must still wait for a digest in flight on the threadpool before tearing
// the runtime down (GitHub issue #1084).

import assert from 'tjs:assert';

import { runTeardownThreadpoolChild } from './helpers/teardown-threadpool-run.js';

const { status, stderr } = await runTeardownThreadpoolChild('teardown-threadpool-sync-throw.js');

assert.eq(status.exit_status, 1, `child exited with the uncaught error status:\n${stderr}`);
assert.ok(stderr.includes('ReferenceError'), `the child reported its error:\n${stderr}`);
