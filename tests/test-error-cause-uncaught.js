import assert from 'tjs:assert';
import path from 'tjs:path';


const args = [
    tjs.exePath,
    'run',
    path.join(import.meta.dirname, 'helpers', 'error-cause-uncaught.js')
];
const proc = tjs.spawn(args, { stdout: 'ignore', stderr: 'pipe' });
const [ status, stderrStr ] = await Promise.all([ proc.wait(), proc.stderr.text() ]);
assert.ok(stderrStr.includes('outer boom'), 'outer error is rendered');
assert.ok(stderrStr.includes('Caused by: Error: middle boom'), 'middle cause is rendered');
assert.ok(stderrStr.includes('Caused by: Error: inner boom'), 'inner cause is rendered');
assert.ok(stderrStr.indexOf('outer boom') < stderrStr.indexOf('middle boom'), 'cause comes after outer');
assert.ok(stderrStr.indexOf('middle boom') < stderrStr.indexOf('inner boom'), 'inner cause comes after middle');
assert.ok(status.exit_status !== 0 && status.term_signal === null, 'process exited non-zero');
