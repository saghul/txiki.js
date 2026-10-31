// An exception thrown during synchronous evaluation of the entry script, with no
// await before it, must still wait for a SHA-1 digest in flight on the threadpool
// before tearing the runtime down (GitHub issue #1084).

import assert from 'tjs:assert';

import { runTeardownThreadpoolChild } from './helpers/teardown-threadpool-run.js';

const { status, stderr } = await runTeardownThreadpoolChild('teardown-threadpool-sync-throw.js');

assert.eq(status.exit_status, 1, `child exited with the uncaught error status:\n${stderr}`);
assert.ok(stderr.includes('ReferenceError'), `the child reported its error:\n${stderr}`);
