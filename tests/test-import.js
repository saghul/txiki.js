import { run, test } from './t.js';
import { foo } from './helpers/a/b/c/d/e/foo.js';

test('import from deep folder', t => {
    t.eq(foo(), 42, 'deep folder import works');
});


if (import.meta.main) {
    run();
}
