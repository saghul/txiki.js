import assert from 'tjs:assert';

if (navigator.userAgentData.platform === 'Windows') {
    // exec() is not available on Windows
    tjs.exit(0);
}

/* Run a program that is expected to exit 0 */
tjs.exec([ tjs.exePath, '-v' ]);
assert.fail('Should not be reached');
