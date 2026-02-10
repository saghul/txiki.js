import assert from 'tjs:assert';
import path from 'tjs:path';


const args = [
    tjs.exePath,
    'run',
    path.join(import.meta.dirname, 'helpers', 'unhandled-rejection.js')
];
const proc = tjs.spawn(args, { stdout: 'ignore', stderr: 'pipe' });
const [ status, stderrStr ] = await Promise.all([ proc.wait(), proc.stderr.text() ]);
assert.ok(stderrStr.match(/Error: oops!/) !== null, 'dumps to stderr');
assert.ok(status.exit_status !== 0 && status.term_signal === null, 'succeeded');
