import assert from 'tjs:assert';
import path from 'tjs:path';


const compileArgs = [
    tjs.exepath,
    'compile',
    path.join(import.meta.dirname, 'helpers', 'hello.js')
];
const proc = tjs.spawn(compileArgs);
const status = await proc.wait();

assert.ok(status.exit_status === 0 && status.term_signal === null, 'succeeded');

const newExe = tjs.platform === 'windows' ? 'hello.exe' : 'hello';

const st = await tjs.stat(newExe);

assert.ok(st.isFile, 'is a regular file');

const proc2 = tjs.spawn(path.join(tjs.cwd(), newExe), { stdout: 'pipe' });
const buf = new Uint8Array(4096);
const nread = await proc2.stdout.read(buf);
const stdoutStr = new TextDecoder().decode(buf.subarray(0, nread));
const status2 = await proc2.wait();
assert.ok(stdoutStr.match(/hello!/) !== null, 'runs');
assert.ok(status2.exit_status === 0 && status.term_signal === null, 'succeeded');
