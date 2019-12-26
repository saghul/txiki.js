import { run, test } from './t.js';

test('hrtime test', t => {
  const time = tjs.hrtime()
  t.ok(Array.isArray(time))
  t.ok(time.length == 2)
  t.ok(typeof time[0] == 'number')
  t.ok(typeof time[1] == 'number')
});

test('hrtimeBigInt test', t => {
  const time = tjs.hrtimeBigInt()
  t.ok(typeof time == 'bigint')
  t.ok(time > 0)
});

if (import.meta.main) {
    run();
}
