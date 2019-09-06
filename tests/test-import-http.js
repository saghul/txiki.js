import { run, test } from './t.js';
import 'https://cdn.jsdelivr.net/npm/lodash@4.17.15/lodash.js';

test('import from HTTP works', t => {
    const words = ['sky', 'wood', 'forest', 'falcon', 'pear', 'ocean', 'universe'];
    t.eq(_.first(words), 'sky', '_.first works');
    t.eq(_.last(words), 'universe', '_.last works');
});


if (import.meta.main) {
    run();
}
