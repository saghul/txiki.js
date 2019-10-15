import { run, test } from './t.js';

test('args is an array', t => {
    t.ok(Array.isArray(tjs.args), 'tjs.args is an array');
});


if (import.meta.main) {
    run();
}
