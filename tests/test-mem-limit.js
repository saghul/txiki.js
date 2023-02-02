import assert from 'tjs:assert';

const MB = 1024 * 1024;

const args = [
    tjs.exepath,
    '--memory-limit',
    `${5 * MB}`,
    'eval',
    `const arr = new Uint8Array(${10 * MB}).fill(1); console.log(arr);`
];
const proc = tjs.spawn(args, { stdout: 'ignore', stderr: 'pipe' });
const buf = new Uint8Array(4096);
const status = await proc.wait();
const nread = await proc.stderr.read(buf);
const stderrStr = new TextDecoder().decode(buf.subarray(0, nread));
console.log(stderrStr);
assert.ok(stderrStr.match(/InternalError: out of memory/) !== null, 'gives memory error');
assert.ok(status.exit_status !== 0 && status.term_signal === null, 'script fails')
