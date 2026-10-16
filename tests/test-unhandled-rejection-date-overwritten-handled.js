import assert from 'tjs:assert';
import path from 'tjs:path';


const args = [
    tjs.exePath,
    'run',
    path.join(import.meta.dirname, 'helpers', 'unhandled-rejection-date-overwritten-handled.js')
];
const proc = tjs.spawn(args, { stdout: 'pipe', stderr: 'pipe' });
const [ status, stdoutStr, stderrStr ] = await Promise.all([
    proc.wait(),
    proc.stdout.text(),
    proc.stderr.text()
]);

assert.eq(status.exit_status, 0, `exits cleanly: ${stderrStr}`);
assert.eq(status.term_signal, null, 'is not killed by a signal');
assert.ok(stdoutStr.includes('handled:'), 'the unhandledrejection listener runs');
