import { run, test } from './t.js';

test('version', t => {
    t.ok(tjs.version, 'tjs.version is defined');
});

test('versions', t => {
    t.ok(tjs.versions, 'tjs.versions is defined');
    t.ok(tjs.versions.tjs, 'tjs.versions.tjs is defined');
    t.ok(tjs.versions.uv, 'tjs.versions.uv is defined');
});


if (import.meta.main) {
    run();
}
