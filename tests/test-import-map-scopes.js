import assert from 'tjs:assert';
import path from 'tjs:path';

const helperDir = path.join(import.meta.dirname, 'helpers');

// Set up a scoped import map.
// Top-level: 'pkg' → import-map-lib.js (exports { value: 'from-import-map' })
// Inside helpers/: 'pkg' → import-map-prefix/utils.js (exports { util: 'prefix-util' })
tjs.setImportMap({
    imports: {
        'pkg': './import-map-lib.js',
    },
    scopes: {
        './': {
            'pkg': './import-map-prefix/utils.js',
        }
    }
}, helperDir);

// This test file is NOT inside helperDir, so the scope should not match.
// 'pkg' should resolve via top-level imports → import-map-lib.js.
const mod = await import('pkg');

assert.eq(mod.value, 'from-import-map', 'top-level import map resolution works');

// Import from a helper that IS inside helperDir.
// import-map-scoped-inner.js does: import { value } from 'pkg'
// Since its parentURL starts with helperDir, the scope matches.
const innerMod = await import(path.join(helperDir, 'import-map-scoped-inner.js'));

assert.eq(innerMod.innerValue, 'prefix-util', 'scoped import map resolution works');
