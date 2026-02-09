import assert from 'tjs:assert';
import { slurpStdio } from './helpers.js';


async function testCliVersion() {
    const args = [
        tjs.exePath,
        '-v'
    ];
    const proc = tjs.spawn(args, { stdout: 'pipe', stderr: 'ignore' });
    await proc.wait();
    const stdoutStr = await slurpStdio(proc.stdout);
    assert.eq(stdoutStr.trim(), `v${tjs.version}`, 'returns the right version');
}

async function testCliHelp() {
    const args = [
        tjs.exePath,
        '-h'
    ];
    const proc = tjs.spawn(args, { stdout: 'pipe', stderr: 'ignore' });
    await proc.wait();
    const stdoutStr = await slurpStdio(proc.stdout);
    assert.ok(stdoutStr.startsWith('Usage: '), 'returns the help');
}

async function testCliBadOption() {
    const args = [
        tjs.exePath,
        '--foo'
    ];
    const proc = tjs.spawn(args, { stdout: 'ignore', stderr: 'pipe' });
    await proc.wait();
    const stderrStr = await slurpStdio(proc.stderr);
    assert.ok(stderrStr.includes('unrecognized option: foo'), 'recognizes a bad option');
}

await testCliVersion();
await testCliHelp();
await testCliBadOption();
