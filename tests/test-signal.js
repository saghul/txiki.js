import assert from './assert.js';


function sleep(seconds) {
    return new Promise(resolve => setTimeout(resolve, seconds*1000));
}

(async () => {
    const h = tjs.signal('SIGINT', () => {
        tjs.exit(0);
    });
    assert.eq(h.signal, 'SIGINT');

    if (tjs.platform === 'windows') {
        /* Signals emulated on Windows do not allow signal() to be tested
         * by sending a signal via kill(), so don't continue the test.
         */
        tjs.exit(0);
    }

    tjs.kill(tjs.pid, 'SIGINT');
    await sleep(1);
    assert.fail('Timed out waiting for signal');
})()
