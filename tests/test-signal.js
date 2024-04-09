import assert from 'tjs:assert';

if (tjs.platform === 'windows') {
    /* Signals emulated on Windows do not allow this to be tested
     * by sending a signal via kill(), so don't continue the test.
     */
    tjs.exit(0);
}

function sleep(seconds) {
    return new Promise(resolve => setTimeout(resolve, seconds*1000));
}

tjs.addSignalListener('SIGINT', () => {
    tjs.exit(0);
});

tjs.kill(tjs.pid, 'SIGINT');
await sleep(1);
assert.fail('Timed out waiting for signal');
