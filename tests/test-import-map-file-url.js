import assert from 'tjs:assert';
import path from 'tjs:path';

tjs.setImportMap({
    imports: {
        'file-url-lib': new URL('./helpers/file-url-mod.js', import.meta.url).href,
    }
}, import.meta.dirname);

const viaMap = await import('file-url-lib');
const viaPath = await import(path.join(import.meta.dirname, 'helpers', 'file-url-mod.js'));

assert.eq(viaMap.x, 42, 'import map entry with a file URL loads');
assert.ok(viaMap === viaPath, 'import map file URL is keyed by native path');
