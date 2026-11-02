import assert from 'tjs:assert';
import path from 'tjs:path';

// XHR withCredentials sends cookies back, and a cookie with Expires is
// persisted to the jar.
//
// Every tjs process shares the jar at $TJS_HOME/cookies.txt, and lws skips
// the jar write while another process holds its lock (the cookie is still
// kept in-process, see test-fetch-cookie-jar-locked). The suite runs many tjs
// processes at once, so the requests run in a child with an isolated TJS_HOME.

const tmpHome = await tjs.makeTempDir('tjs-cookie-jar-XXXXXX');
try {
    const args = [
        tjs.exePath,
        'run',
        path.join(import.meta.dirname, 'helpers', 'xhr-credentials.js'),
    ];
    const proc = tjs.spawn(args, {
        stdout: 'ignore',
        stderr: 'pipe',
        env: { ...tjs.env, TJS_HOME: tmpHome },
    });
    const [ status, stderr ] = await Promise.all([ proc.wait(), proc.stderr.text() ]);

    assert.eq(status.exit_status, 0, `child exited non-zero: ${stderr}`);
} finally {
    await tjs.remove(tmpHome);
}
