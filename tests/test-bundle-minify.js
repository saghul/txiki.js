import assert from 'tjs:assert';
import path from 'tjs:path';


const inputFile = path.join(import.meta.dirname, 'helpers', 'bundle-input.js');
const tmpDir = await tjs.makeTempDir(path.join(tjs.tmpDir, 'tjs-bundle-test-XXXXXX'));

async function bundleRun(args) {
    const proc = tjs.spawn(
        [ tjs.exePath, 'bundle', ...args ],
        { stdout: 'pipe', stderr: 'pipe' },
    );
    const [ status, stdout, stderr ] = await Promise.all([
        proc.wait(),
        proc.stdout.text(),
        proc.stderr.text(),
    ]);

    return { code: status.exit_status, stdout, stderr };
}

const outfile = path.join(tmpDir, 'minified.js');
const outfileNoMin = path.join(tmpDir, 'not-minified.js');

await bundleRun([ inputFile, outfileNoMin ]);
await bundleRun([ '--minify', inputFile, outfile ]);

const stMin = await tjs.stat(outfile);
const stNoMin = await tjs.stat(outfileNoMin);

assert.ok(stMin.size > 0, 'minified output is not empty');
assert.ok(stMin.size <= stNoMin.size, 'minified output is not larger');

// The minified bundle should still run.
const proc = tjs.spawn([ tjs.exePath, 'run', outfile ], { stdout: 'pipe', stderr: 'pipe' });
const [ status, stdout ] = await Promise.all([ proc.wait(), proc.stdout.text() ]);

assert.equal(status.exit_status, 0, 'minified file runs successfully');
assert.ok(stdout.includes('hello from bundle'), 'output contains expected text');

await tjs.remove(tmpDir);
