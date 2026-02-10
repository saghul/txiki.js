import assert from 'tjs:assert';
import path from 'tjs:path';


const compileArgs = [
    tjs.exePath,
    'compile',
    path.join(import.meta.dirname, 'helpers', 'hello.js')
];
const proc = tjs.spawn(compileArgs);
const status = await proc.wait();

assert.ok(status.exit_status === 0 && status.term_signal === null, 'succeeded');

const newExe = navigator.userAgentData.platform === 'Windows' ? 'hello.exe' : 'hello';

const st = await tjs.stat(newExe);

assert.ok(st.isFile, 'is a regular file');

const proc2 = tjs.spawn(path.join(tjs.cwd, newExe), { stdout: 'pipe' });
const [ status2, stdoutStr ] = await Promise.all([ proc2.wait(), proc2.stdout.text() ]);
assert.ok(stdoutStr.match(/hello!/) !== null, 'runs');
assert.ok(status2.exit_status === 0 && status.term_signal === null, 'succeeded');

await tjs.remove(newExe);
