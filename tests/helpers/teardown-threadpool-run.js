// Shared body of the tests that tear a runtime down while threadpool work it
// started (fs, crypto.subtle, DNS) is still running. Teardown must wait for that
// work instead of freeing memory the threadpool thread still uses, which crashes
// a Release build and shows up as a heap-use-after-free under ASAN.

import assert from 'tjs:assert';
import path from 'tjs:path';

// Fail with a clear message well before the runner's 30 s timeout.
const TIMEOUT = 20000;

export async function runTeardownThreadpoolChild(helper, ...args) {
    const proc = tjs.spawn([ tjs.exePath, 'run', path.join(import.meta.dirname, helper), ...args ], {
        stdout: 'pipe',
        stderr: 'pipe'
    });

    let timer;
    const expired = new Promise(resolve => {
        timer = setTimeout(resolve, TIMEOUT);
    });
    const result = await Promise.race([
        Promise.all([ proc.wait(), proc.stdout.text(), proc.stderr.text() ]),
        expired
    ]);

    clearTimeout(timer);

    if (!result) {
        proc.kill('SIGKILL');
        await proc.wait();
        assert.fail(`child (${helper}) did not exit within ${TIMEOUT} ms: teardown hung`);
    }

    const [ status, stdout, stderr ] = result;

    assert.eq(status.term_signal, null, `child was not killed by a signal:\n${stderr}`);
    assert.ok(!stderr.includes('AddressSanitizer'), `no ASAN report:\n${stderr}`);

    return { status, stdout, stderr };
}
