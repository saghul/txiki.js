import { run, sleep, test } from './t.js';

test('performance now', async t => {
    const start = performance.now();
    await sleep(100);
    t.ok(performance.now() - start >= 100, 'performance.now() works');
});

test('performance mark', async t => {
    const m1 = 'mark1';
    const m2 = 'mark2';
    performance.mark(m1);
    await sleep(100);
    performance.mark(m2);
    performance.measure('m', m1, m2);
    let entries = performance.getEntriesByName('m');
    t.equal(entries.length, 1, 'there should be 1 entry');
    t.ok(entries[0].duration >= 100, 'duration is >= 100');
    performance.clearMeasures();
    entries = performance.getEntriesByName('m');
    t.equal(entries.length, 0, 'there should be 0 entries');
});


if (import.meta.main) {
    run();
}
