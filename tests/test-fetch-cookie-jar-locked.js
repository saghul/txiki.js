import assert from 'tjs:assert';
import path from 'tjs:path';

// While another process holds the cookie jar's lock (cookies.txt.LCK), lws
// does not wait for it: the jar write is skipped. A cookie set meanwhile must
// still be kept in-process and sent back on the next request
// (patches/lws-cache-l1-serves-when-jar-busy.patch).
//
// The cookie jar path is a process-level singleton fixed at startup from
// TJS_HOME, so the requests run in a child process with an isolated TJS_HOME
// whose jar we hold locked for the whole run.

const tmpHome = await tjs.makeTempDir('tjs-cookie-jar-XXXXXX');
const lockPath = path.join(tmpHome, 'cookies.txt.LCK');
try {
    // A fresh lock file: lws only breaks one older than 30 s.
    await tjs.writeFile(lockPath, '');

    const args = [
        tjs.exePath,
        'run',
        path.join(import.meta.dirname, 'helpers', 'set-cookie-jar-locked.js'),
    ];
    const proc = tjs.spawn(args, {
        stdout: 'pipe',
        stderr: 'pipe',
        env: { ...tjs.env, TJS_HOME: tmpHome },
    });
    const [ status, stdout, stderr ] = await Promise.all([ proc.wait(), proc.stdout.text(), proc.stderr.text() ]);

    assert.eq(status.exit_status, 0, `child exited non-zero: ${stderr}`);

    const { cookie } = JSON.parse(stdout.trim());
    const sent = (cookie ?? '').split('; ').sort().join('; ');

    assert.eq(sent, 'kept=k1; sess=s1', 'both cookies are sent back in-process');

    // The jar really was busy for the whole run: the lock is still ours and
    // nothing reached the file.
    await tjs.stat(lockPath);

    let jar = '';

    try {
        jar = new TextDecoder().decode(await tjs.readFile(path.join(tmpHome, 'cookies.txt')));
    } catch {
        // No jar at all also means nothing was persisted.
    }

    assert.ok(!jar.includes('k1'), 'the cookie was not persisted while the jar was locked');
} finally {
    await tjs.remove(tmpHome);
}
