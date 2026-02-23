import assert from 'tjs:assert';


async function testServeNoFile() {
    const args = [
        tjs.exePath,
        'serve',
    ];
    const proc = tjs.spawn(args, { stdout: 'ignore', stderr: 'pipe' });
    const status = await proc.wait();
    assert.ok(status.exit_status !== 0, 'exits with error when no file given');
}

await testServeNoFile();
