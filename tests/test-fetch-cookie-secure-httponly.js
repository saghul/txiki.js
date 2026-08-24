import assert from 'tjs:assert';
import path from 'tjs:path';

// Regression test for issue #1064: a Set-Cookie whose attributes include
// Secure and/or HttpOnly must be persisted to the cookie jar with its real
// name and value. An upstream libwebsockets parser bug (warmcat #3652)
// aliased the httponly/secure flags onto the cookie name/value slots and
// clobbered both with the literal string "T", breaking session persistence
// for `credentials: 'include'` fetches and XMLHttpRequest.withCredentials.
//
// The cookie jar path is a process-level singleton fixed at startup from
// TJS_HOME, so we replay the request in a child process with an isolated
// TJS_HOME and inspect the jar it writes.

const tmpHome = await tjs.makeTempDir('tjs-cookie-jar-XXXXXX');
try {
    const args = [
        tjs.exePath,
        'run',
        path.join(import.meta.dirname, 'helpers', 'set-cookie-secure-httponly.js'),
    ];
    const proc = tjs.spawn(args, {
        stdout: 'ignore',
        stderr: 'pipe',
        env: { ...tjs.env, TJS_HOME: tmpHome },
    });
    const [ status, stderr ] = await Promise.all([ proc.wait(), proc.stderr.text() ]);
    assert.eq(status.exit_status, 0, `child exited non-zero: ${stderr}`);

    const jar = new TextDecoder().decode(await tjs.readFile(path.join(tmpHome, 'cookies.txt')));

    // Netscape cookie jar, tab-separated:
    // domain  hostonly  path  secure  expires  name  value
    // Split on \r?\n: the jar is written with \r\n line endings on Windows.
    const line = jar.split(/\r?\n/).find(l => l && !l.startsWith('#'));
    assert.ok(line, 'a cookie was persisted');

    const fields = line.split('\t');
    assert.eq(fields.length, 7, 'cookie line has all Netscape fields');
    assert.eq(fields[3], 'TRUE', 'Secure flag parsed onto its own column');
    assert.eq(fields[5], 'session', 'cookie name is intact (not clobbered to "T")');
    assert.eq(fields[6], 'abc123def456', 'cookie value is intact (not clobbered to "T")');
} finally {
    await tjs.remove(tmpHome);
}
