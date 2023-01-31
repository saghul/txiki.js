import assert from 'tjs:assert';


async function testCliVersion() {
    const args = [
        tjs.exepath,
        '-v'
    ];
    const proc = tjs.spawn(args, { stdout: 'pipe', stderr: 'ignore' });
    const buf = new Uint8Array(4096);
    const nread = await proc.stdout.read(buf);
    const stdoutStr = new TextDecoder().decode(buf.subarray(0, nread));
    await proc.wait();
    assert.eq(stdoutStr.trim(), `v${tjs.version}`, 'returns the right version');
}

async function testCliHelp() {
    const args = [
        tjs.exepath,
        '-h'
    ];
    const proc = tjs.spawn(args, { stdout: 'pipe', stderr: 'ignore' });
    const buf = new Uint8Array(4096);
    const nread = await proc.stdout.read(buf);
    const stdoutStr = new TextDecoder().decode(buf.subarray(0, nread));
    await proc.wait();
    assert.ok(stdoutStr.startsWith('Usage: '), 'returns the help');
}

async function testCliBadOption() {
    const args = [
        tjs.exepath,
        '--foo'
    ];
    const proc = tjs.spawn(args, { stdout: 'pipe', stderr: 'ignore' });
    const buf = new Uint8Array(4096);
    const nread = await proc.stdout.read(buf);
    const stdoutStr = new TextDecoder().decode(buf.subarray(0, nread));
    await proc.wait();
    assert.ok(stdoutStr.includes('unrecognized option: foo'), 'recognizes a bad option');
}

await testCliVersion();
await testCliHelp();
await testCliBadOption();
