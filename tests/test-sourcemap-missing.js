import assert from 'tjs:assert';
import path from 'tjs:path';

const filePath = path.join(import.meta.dirname, 'helpers', 'sourcemap-no-map.js');
const proc = tjs.spawn([ tjs.exePath, 'run', filePath ], { stdout: 'ignore', stderr: 'pipe' });
const [ status, stderrStr ] = await Promise.all([ proc.wait(), proc.stderr.text() ]);

assert.ok(status.exit_status !== 0, 'process exits with error');
assert.ok(stderrStr.includes('sourcemap-no-map.js'), 'stack trace references the original file');
assert.ok(stderrStr.includes('throwHere'), 'stack trace includes function name');
assert.ok(stderrStr.includes('no sourcemap'), 'error message is present');
