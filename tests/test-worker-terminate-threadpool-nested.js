// A worker runtime is torn down on the thread of whoever terminates it, not the
// thread that created it. JS the teardown drain runs there (a digest
// continuation) must not trip QuickJS's stack check, which still points at the
// creating thread's stack.

import assert from 'tjs:assert';

import { runTeardownThreadpoolChild } from './helpers/teardown-threadpool-run.js';

const { status, stdout, stderr } = await runTeardownThreadpoolChild('worker-terminate-threadpool-nested.js');

assert.eq(status.exit_status, 0, `child exited cleanly:\n${stderr}`);
assert.ok(stdout.includes('DRAIN-JS-RAN'), `the leaf's digest continuation ran during teardown:\n${stdout}`);
assert.ok(stdout.includes('nested: ok'), `the child terminated its worker:\n${stdout}`);
