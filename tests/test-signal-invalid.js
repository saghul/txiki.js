import assert from 'tjs:assert';

if (navigator.userAgentData.platform === 'Windows') {
    /* SIGKILL/SIGSTOP don't exist on Windows. */
    tjs.exit(0);
}

/* Registering a listener for an unkillable signal must throw, and must not
 * corrupt libuv's handle queue — regression test for a use-after-free where
 * the signal wrapper was freed without closing the already-initialized
 * uv_signal_t handle.
 */
for (const name of ['SIGKILL', 'SIGSTOP']) {
    assert.throws(() => tjs.addSignalListener(name, () => {}));
}

/* Force more libuv handle activity; under the old bug this would write
 * through freed memory and ASAN/UBSAN would flag it.
 */
await new Promise(resolve => setTimeout(resolve, 10));
await new Promise(resolve => setTimeout(resolve, 10));
