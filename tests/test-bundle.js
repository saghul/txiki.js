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

// Test 1: bundle with explicit outfile
async function testBundleBasic() {
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
}

// Test 2: bundle with default outfile name
async function testBundleDefaultOutfile() {
    // Copy input to tmpDir so the default output goes there too.
    const localInput = path.join(tmpDir, 'myapp.js');

    await tjs.copyFile(inputFile, localInput);

    const r = await bundleRun([ localInput ]);

    assert.equal(r.code, 0, 'bundle exits 0');

    const expectedOut = path.join(tmpDir, 'myapp.bundle.js');
    const st = await tjs.stat(expectedOut);

    assert.ok(st.isFile, 'default output file exists');
}

// Test 3: bundle with --minify
async function testBundleMinify() {
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
}

// Test 4: bundle with no args shows help
async function testBundleNoArgs() {
    const r = await bundleRun([]);

    assert.notEqual(r.code, 0, 'exits non-zero');
    assert.ok(r.stderr.includes('Usage:'), 'shows help text');
}

// Test 5: bundle preserves tjs:* imports (they should be external)
async function testBundleExternalImports() {
    const outfile = path.join(tmpDir, 'external.js');

    await bundleRun([ inputFile, outfile ]);

    const content = new TextDecoder().decode(await tjs.readFile(outfile));

    assert.ok(content.includes('tjs:path'), 'tjs:path import is preserved');
}

await testBundleBasic();
await testBundleDefaultOutfile();
await testBundleMinify();
await testBundleNoArgs();
await testBundleExternalImports();

// Clean up.
await tjs.remove(tmpDir);
