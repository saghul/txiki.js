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

const outfile = path.join(tmpDir, 'basic.js');
const r = await bundleRun([ inputFile, outfile ]);

assert.equal(r.code, 0, 'bundle exits 0');

const st = await tjs.stat(outfile);

assert.ok(st.isFile, 'output file exists');
assert.ok(st.size > 0, 'output file is not empty');

// The bundle should be runnable and produce expected output.
const proc = tjs.spawn([ tjs.exePath, 'run', outfile ], { stdout: 'pipe', stderr: 'pipe' });
const [ status, stdout ] = await Promise.all([ proc.wait(), proc.stdout.text() ]);

assert.equal(status.exit_status, 0, 'bundled file runs successfully');
assert.ok(stdout.includes('hello from bundle'), 'output contains expected text');
assert.ok(stdout.includes(path.join('a', 'b')), 'output contains path.join result');

await tjs.remove(tmpDir);
