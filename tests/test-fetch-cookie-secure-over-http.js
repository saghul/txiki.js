import assert from 'tjs:assert';
import path from 'tjs:path';

// A Secure cookie set over plain http:// must not be stored, and so is never
// sent back (RFC 6265bis 5.7; lws >= 5.1, upstream 9ec736c7e). A plain cookie
// set by the same response is the control: it is stored and sent.
//
// The cookie jar path is a process-level singleton fixed at startup from
// TJS_HOME, so the requests run in a child process with an isolated TJS_HOME.

const tmpHome = await tjs.makeTempDir('tjs-cookie-jar-XXXXXX');
try {
    const args = [
        tjs.exePath,
        'run',
        path.join(import.meta.dirname, 'helpers', 'set-cookie-secure-over-http.js'),
    ];
    const proc = tjs.spawn(args, {
        stdout: 'pipe',
        stderr: 'pipe',
        env: { ...tjs.env, TJS_HOME: tmpHome },
    });
    const [ status, stdout, stderr ] = await Promise.all([ proc.wait(), proc.stdout.text(), proc.stderr.text() ]);

    assert.eq(status.exit_status, 0, `child exited non-zero: ${stderr}`);

    const { cookie } = JSON.parse(stdout.trim());

    assert.eq(cookie, 'plain=p1', 'only the plain cookie is sent back');

    let jar = '';

    try {
        jar = new TextDecoder().decode(await tjs.readFile(path.join(tmpHome, 'cookies.txt')));
    } catch {
        // No jar at all also means nothing was stored.
    }

    // Netscape cookie jar, tab-separated:
    // domain  hostonly  path  secure  expires  name  value
    const names = jar.split(/\r?\n/)
        .filter(l => l && !l.startsWith('#'))
        .map(l => l.split('\t')[5]);

    assert.ok(!names.includes('sec'), 'the Secure cookie was not stored');
} finally {
    await tjs.remove(tmpHome);
}
