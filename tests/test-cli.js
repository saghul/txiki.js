import assert from 'tjs:assert';


async function testCliVersion() {
    const args = [
        tjs.exePath,
        '-v'
    ];
    const proc = tjs.spawn(args, { stdout: 'pipe', stderr: 'ignore' });
    const stdoutStr = await proc.stdout.text();
    assert.eq(stdoutStr.trim(), `v${tjs.version}`, 'returns the right version');
}

async function testCliHelp() {
    const args = [
        tjs.exePath,
        '-h'
    ];
    const proc = tjs.spawn(args, { stdout: 'pipe', stderr: 'ignore' });
    const stdoutStr = await proc.stdout.text();
    assert.ok(stdoutStr.startsWith('Usage: '), 'returns the help');
}

async function testCliBadOption() {
    const args = [
        tjs.exePath,
        '--foo'
    ];
    const proc = tjs.spawn(args, { stdout: 'ignore', stderr: 'pipe' });
    const stderrStr = await proc.stderr.text();
    assert.ok(stderrStr.includes('unrecognized option: foo'), 'recognizes a bad option');
}

await testCliVersion();
await testCliHelp();
await testCliBadOption();
