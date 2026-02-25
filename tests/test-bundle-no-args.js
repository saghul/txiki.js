import assert from 'tjs:assert';


async function bundleRun(args) {
    const proc = tjs.spawn(
        [ tjs.exePath, 'bundle', ...args ],
        { stdout: 'pipe', stderr: 'pipe' },
    );
    const [ status, stdout, stderr ] = await Promise.all([
        proc.wait(),
        proc.stdout.text(),
        proc.stderr.text(),
    ]);

    return { code: status.exit_status, stdout, stderr };
}

const r = await bundleRun([]);

assert.notEqual(r.code, 0, 'exits non-zero');
assert.ok(r.stderr.includes('Usage:'), 'shows help text');
