import assert from 'tjs:assert';
import path from 'tjs:path';


const args = [
    tjs.exePath,
    'run',
    path.join(import.meta.dirname, 'helpers', 'error-cause-log.js')
];
const proc = tjs.spawn(args, { stdout: 'pipe', stderr: 'ignore' });
const [ status, stdoutStr ] = await Promise.all([ proc.wait(), proc.stdout.text() ]);
assert.ok(stdoutStr.includes('outer boom'), 'outer error is logged');
assert.ok(stdoutStr.includes('Caused by: Error: inner boom'), 'cause is logged');
assert.ok(stdoutStr.indexOf('outer boom') < stdoutStr.indexOf('inner boom'), 'cause comes after outer');
assert.eq(status.exit_status, 0, 'process exited cleanly');
