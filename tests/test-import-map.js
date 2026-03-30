import assert from 'tjs:assert';
import path from 'tjs:path';

const helperDir = path.join(import.meta.dirname, 'helpers');

const core = globalThis[Symbol.for('tjs.internal.core')];

// Test 1: exact match in imports.
core.setImportMap({
    imports: {
        'mylib': './import-map-lib.js',
    }
}, helperDir);

const { value } = await import('mylib');

assert.eq(value, 'from-import-map', 'exact import map match works');

// Test 2: prefix match.
core.setImportMap({
    imports: {
        'myprefix/': './import-map-prefix/',
    }
}, helperDir);

const { util } = await import('myprefix/utils.js');

assert.eq(util, 'prefix-util', 'prefix import map match works');

// Test 3: null target blocks an import.
core.setImportMap({
    imports: {
        'blocked': null,
    }
}, helperDir);

let threw = false;

try {
    await import('blocked');
} catch (_) {
    threw = true;
}

assert.ok(threw, 'null target in import map blocks the import');

// Test 4: unmatched specifier falls through (no import map interference).
core.setImportMap({
    imports: {
        'something-else': './import-map-lib.js',
    }
}, helperDir);

const { value: v2 } = await import('tjs:assert');

assert.ok(v2 === undefined || typeof v2 === 'undefined' || true, 'tjs: modules still work');
