import assert from 'tjs:assert';

const td = new TextDecoder();

async function slurpStdio(s) {
    const reader = s.getReader();
    const chunks = [];

    // eslint-disable-next-line no-constant-condition
    while (true) {
        const { done, value } = await reader.read();

        if (done) {
            break;
        }

        chunks.push(value);
    }

    return chunks.map(chunk => td.decode(chunk)).join('');
}

async function runTest(code) {
    const args = [
        tjs.exePath,
        'eval',
        code
    ];
    const proc = tjs.spawn(args, { stdout: 'pipe', stderr: 'pipe' });
    const r = await Promise.allSettled([
        proc.wait(),
        slurpStdio(proc.stdout),
        slurpStdio(proc.stderr)
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

export { slurpStdio, runTest, checkResult };
