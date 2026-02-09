import assert from 'tjs:assert';


async function testCliVersion() {
    const args = [
        tjs.exePath,
        '-v'
    ];
    const proc = tjs.spawn(args, { stdout: 'pipe', stderr: 'ignore' });
    await proc.wait();
    const { value } = await proc.stdout.getReader().read();
    const stdoutStr = new TextDecoder().decode(value);
    assert.eq(stdoutStr.trim(), `v${tjs.version}`, 'returns the right version');
}

async function testCliHelp() {
    const args = [
        tjs.exePath,
        '-h'
    ];
    const proc = tjs.spawn(args, { stdout: 'pipe', stderr: 'ignore' });
    await proc.wait();
    const { value } = await proc.stdout.getReader().read();
    const stdoutStr = new TextDecoder().decode(value);
    assert.ok(stdoutStr.startsWith('Usage: '), 'returns the help');
}

async function testCliBadOption() {
    const args = [
        tjs.exePath,
        '--foo'
    ];
    const proc = tjs.spawn(args, { stdout: 'pipe', stderr: 'ignore' });
    await proc.wait();
    const { value } = await proc.stdout.getReader().read();
    const stdoutStr = new TextDecoder().decode(value);
    assert.ok(stdoutStr.includes('unrecognized option: foo'), 'recognizes a bad option');
}

await testCliVersion();
await testCliHelp();
await testCliBadOption();
