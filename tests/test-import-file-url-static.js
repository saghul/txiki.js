import assert from 'tjs:assert';
import path from 'tjs:path';

// The absolute URL isn't known statically, so write a module that imports it.
const target = new URL('./helpers/file-url-mod.js', import.meta.url).href;
const tmpDir = await tjs.makeTempDir(path.join(tjs.tmpDir, 'tjs-test-import-file-url-XXXXXX'));
const entry = path.join(tmpDir, 'entry.js');

await tjs.writeFile(entry, `import { x } from '${target}';\nexport default x;\n`);

try {
    const ns = await import(entry);

    assert.eq(ns.default, 42, 'static import from a file URL works');
} finally {
    await tjs.remove(tmpDir, { recursive: true });
}
