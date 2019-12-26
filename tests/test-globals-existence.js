import { run, test } from './t.js';

test('global existence', t => {
  t.ok(fs)
  t.ok(typeof fs !== 'undefined')
});


if (import.meta.main) {
    run();
}
