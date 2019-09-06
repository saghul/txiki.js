import { run, test } from './t.js';

test('version', t => {
    t.ok(quv.version, 'quv.version is defined');
});

test('versions', t => {
    t.ok(quv.versions, 'quv.versions is defined');
    t.ok(quv.versions.quv, 'quv.versions.quv is defined');
    t.ok(quv.versions.uv, 'quv.versions.uv is defined');
});


if (import.meta.main) {
    run();
}
