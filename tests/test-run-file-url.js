import assert from 'tjs:assert';
import path from 'tjs:path';

const url = new URL('./helpers/file-url-run.js', import.meta.url).href;
const proc = tjs.spawn([ tjs.exePath, 'run', url ], {
    stdout: 'pipe',
    stderr: 'pipe',
});

const status = await proc.wait();
const stdout = await proc.stdout.text();
const stderr = await proc.stderr.text();

assert.eq(status.exit_status, 0, `process should exit cleanly, stderr: ${stderr}`);

const meta = JSON.parse(stdout);

assert.eq(meta.main, true, 'module is the main module');
assert.eq(meta.path, path.join(import.meta.dirname, 'helpers', 'file-url-run.js'), 'import.meta.path is a native path');
assert.eq(meta.x, 42, 'relative import inside the main module works');
