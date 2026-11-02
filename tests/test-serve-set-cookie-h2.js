import assert from 'tjs:assert';
import path from 'tjs:path';

// Two Set-Cookie headers sent by tjs.serve over HTTP/2 must reach the client
// as two cookies: a credentialed fetch stores both and sends both back. The
// fetch client merges repeated response headers itself, so the check goes
// through the cookie jar, which a child process gets in an isolated TJS_HOME.

const tmpHome = await tjs.makeTempDir('tjs-cookie-jar-XXXXXX');

try {
    const args = [
        tjs.exePath,
        'run',
        path.join(import.meta.dirname, 'helpers', 'serve-set-cookie-h2.js'),
    ];
    const proc = tjs.spawn(args, {
        stdout: 'pipe',
        stderr: 'pipe',
        env: { ...tjs.env, TJS_HOME: tmpHome },
    });
    const [ status, stdout, stderr ] = await Promise.all([ proc.wait(), proc.stdout.text(), proc.stderr.text() ]);

    assert.eq(status.exit_status, 0, `child exited non-zero: ${stderr}`);

    const { httpVersion, cookie } = JSON.parse(stdout);

    assert.eq(httpVersion, '2', 'request went over HTTP/2');
    assert.eq(cookie.split('; ').sort(), [ 'a=1', 'b=2' ], 'both cookies were stored and sent back');
} finally {
    await tjs.remove(tmpHome);
}
