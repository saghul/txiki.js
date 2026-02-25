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

// Copy input to tmpDir so the default output goes there too.
const localInput = path.join(tmpDir, 'myapp.js');

await tjs.copyFile(inputFile, localInput);

const r = await bundleRun([ localInput ]);

assert.equal(r.code, 0, 'bundle exits 0');

const expectedOut = path.join(tmpDir, 'myapp.bundle.js');
const st = await tjs.stat(expectedOut);

assert.ok(st.isFile, 'default output file exists');

await tjs.remove(tmpDir);
