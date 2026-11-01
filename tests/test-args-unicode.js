import assert from 'tjs:assert';
import path from 'tjs:path';

// Characters that no single Windows ANSI code page covers, so a CRT-provided argv would
// mangle at least some of them.
const name = 'ünïcödé-中文-русский-😀';

const tmpDir = await tjs.makeTempDir(path.join(tjs.tmpDir, 'tjs-test-args-XXXXXX'));

try {
    const scriptDir = path.join(tmpDir, name);

    await tjs.makeDir(scriptDir);

    const script = path.join(scriptDir, 'main.js');

    await tjs.writeFile(script, 'console.log(JSON.stringify(tjs.args.slice(2)));');

    const proc = tjs.spawn([ tjs.exePath, 'run', script, name ], { stdout: 'pipe', stderr: 'pipe' });
    const [ status, stdout, stderr ] = await Promise.all([
        proc.wait(),
        proc.stdout.text(),
        proc.stderr.text(),
    ]);

    assert.eq(status.exit_status, 0, `child failed: ${stderr}`);
    assert.equal(JSON.parse(stdout), [ script, name ]);
} finally {
    await tjs.remove(tmpDir, { recursive: true });
}
