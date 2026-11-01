import assert from 'tjs:assert';
import path from 'tjs:path';

const tmpDir = await tjs.makeTempDir(path.join(tjs.tmpDir, 'tjs-test-import-file-url-XXXXXX'));
const dir = path.join(tmpDir, 'with space');

await tjs.makeDir(dir);
await tjs.writeFile(path.join(dir, 'my mod.js'), 'export const x = 42;\n');

// Build the URL from a native path the way pathToFileURL() would, so it is
// valid on Windows too (file:///C:/...).
const posixPath = path.join(dir, 'my mod.js').replaceAll('\\', '/');
const url = new URL(posixPath.startsWith('/') ? posixPath : `/${posixPath}`, 'file:///');

assert.ok(url.href.includes('with%20space/my%20mod.js'), 'URL is percent-encoded');

try {
    const ns = await import(url.href);

    assert.eq(ns.x, 42, 'percent-encoded file URL is decoded');
} finally {
    await tjs.remove(tmpDir, { recursive: true });
}
