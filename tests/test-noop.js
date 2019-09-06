import { run, test } from './t.js';

test('noop', t => {
    t.ok(true, 'true is truthy');
});


if (import.meta.main) {
    run();
}
