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

const outfile = path.join(tmpDir, 'external.js');

await bundleRun([ inputFile, outfile ]);

const content = new TextDecoder().decode(await tjs.readFile(outfile));

assert.ok(content.includes('tjs:path'), 'tjs:path import is preserved');

await tjs.remove(tmpDir);
