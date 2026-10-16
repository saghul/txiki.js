import assert from 'tjs:assert';
import path from 'tjs:path';


const tmpDir = await tjs.makeTempDir(path.join(tjs.tmpDir, 'tjs-test-app-XXXXXX'));
const origCwd = tjs.cwd;

tjs.chdir(tmpDir);

try {
    const initProc = tjs.spawn([ tjs.exePath, 'app', 'init' ]);

    assert.eq((await initProc.wait()).exit_status, 0, 'app init succeeded');

    const compileProc = tjs.spawn([ tjs.exePath, 'app', 'compile', 'myapp' ], { stdout: 'pipe' });
    const [ compileStatus, compileOut ] = await Promise.all([ compileProc.wait(), compileProc.stdout.text() ]);

    assert.eq(compileStatus.exit_status, 0, 'app compile succeeded');

    const buildId = compileOut.match(/\(build ([0-9a-f]+)\)/)[1];
    const exeFileName = navigator.userAgentData.platform === 'Windows' ? 'myapp.exe' : 'myapp';
    const exePath = path.join(tmpDir, exeFileName);
    const tjsHome = path.join(tmpDir, 'home');
    const env = { ...tjs.env, TJS_HOME: tjsHome };

    const run = async () => {
        const proc = tjs.spawn(exePath, { stdout: 'pipe', stderr: 'pipe', env });
        const [ status, stdout, stderr ] = await Promise.all([
            proc.wait(),
            proc.stdout.text(),
            proc.stderr.text(),
        ]);

        return { status, stdout, stderr };
    };

    const first = await run();

    assert.eq(first.status.exit_status, 0, 'first run succeeded');
    assert.eq(first.stdout.trim(), 'Hello from tpk!');

    const cacheDir = path.join(tjsHome, 'tpk_cache', buildId);

    // Emulate a cleaner that deletes the files but leaves the directories behind.
    await tjs.remove(path.join(cacheDir, 'app.json'));

    const second = await run();

    assert.notEqual(second.status.exit_status, 0, 'run with missing app.json fails');
    assert.ok(second.stderr.includes('TPK cache is corrupted'), 'error reports corrupted cache');

    await tjs.remove(cacheDir, { recursive: true });
    assert.eq((await run()).status.exit_status, 0, 'run after removing the cache succeeded');

    // A directory in place of the entry point is not a regular file either.
    await tjs.remove(path.join(cacheDir, 'src', 'main.js'));
    await tjs.makeDir(path.join(cacheDir, 'src', 'main.js'));

    const third = await run();

    assert.notEqual(third.status.exit_status, 0, 'run with non-file entry point fails');
    assert.ok(third.stderr.includes('TPK cache is corrupted'), 'error reports corrupted cache');
} finally {
    tjs.chdir(origCwd);
    await tjs.remove(tmpDir, { recursive: true });
}
