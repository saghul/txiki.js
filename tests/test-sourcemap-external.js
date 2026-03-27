import assert from 'tjs:assert';
import path from 'tjs:path';

const bundlePath = path.join(import.meta.dirname, 'helpers', 'sourcemap-external-bundle.js');
const proc = tjs.spawn([ tjs.exePath, 'run', bundlePath ], { stdout: 'ignore', stderr: 'pipe' });
const [ status, stderrStr ] = await Promise.all([ proc.wait(), proc.stderr.text() ]);

assert.ok(status.exit_status !== 0, 'process exits with error');
assert.ok(stderrStr.includes('sourcemap-src/a.js'), 'stack trace references original source file');
assert.ok(stderrStr.includes('throwFromA'), 'stack trace includes function name');
assert.ok(!stderrStr.includes('sourcemap-external-bundle.js'), 'stack trace does not reference bundle file');
