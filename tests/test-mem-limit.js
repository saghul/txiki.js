import assert from './assert.js';

(async () => {
    const args = [
        tjs.exepath,
        '--memory-limit',
        '10485760',
        '-e',
        'new Uint8Array(104857600)'
    ];
    const proc = tjs.spawn(args, { stdout: 'ignore', stderr: 'pipe' });
    const buf = new Uint8Array(4096);
    const nread = await proc.stderr.read(buf);
    const stderrStr = new TextDecoder().decode(buf.subarray(0, nread));
    const status = await proc.wait();
    assert.ok(stderrStr.match(/InternalError: out of memory/) !== null, 'gives memory error');
    assert.ok(status.exit_status === 1 && status.term_signal === null, 'script fails')
})();
