import assert from 'tjs:assert';
import path from 'tjs:path';

const mapFile = path.join(import.meta.dirname, 'fixtures', 'import-map-simple.json');
const scriptFile = path.join(import.meta.dirname, 'helpers', 'import-map-entrypoint.js');

// Test --import-map CLI flag.
const proc = tjs.spawn([ tjs.exePath, 'run', `--import-map=${mapFile}`, scriptFile ], {
    stdout: 'pipe',
    stderr: 'pipe',
});

const status = await proc.wait();
const stdout = await proc.stdout.text();
const stderr = await proc.stderr.text();

assert.eq(status.exit_status, 0, `process should exit cleanly, stderr: ${stderr}`);
assert.ok(stdout.includes('from-import-map'), 'import map flag works end-to-end');
