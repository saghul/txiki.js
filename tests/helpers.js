import assert from 'tjs:assert';

async function runTest(code) {
    const args = [
        tjs.exePath,
        'eval',
        code
    ];
    const proc = tjs.spawn(args, { stdout: 'pipe', stderr: 'pipe' });
    const r = await Promise.allSettled([
        proc.wait(),
        proc.stdout.text(),
        proc.stderr.text()
    ]);
    const status = r[0].value;
    const stdout = r[1].value;
    const stderr = r[2].value;

    return { code: status?.exit_status, stdout, stderr };
}

function checkResult(resultData, match, name) {
    if (match instanceof RegExp) {
        assert.truthy(resultData.match(match), name + ' does not match');
    } else {
        assert.equal(resultData, match, name + ' does not equal');
    }
}

export { runTest, checkResult };
