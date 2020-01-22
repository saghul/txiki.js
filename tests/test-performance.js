import { run, test } from './t.js';

test('performance now', t => {
    const start = performance.now();
    t.eq(typeof start, 'number', 'performance.now() returns Number');

    // Busy loop
    const now = Date.now();
    while (Date.now() - now < 2000);

    const diff = Math.round(performance.now() - start);
    t.ok(diff >= 1000 && diff <= 2000, 'performance.now() works');
});

test('performance mark', t => {
    const m1 = 'mark1';
    const m2 = 'mark2';
    performance.mark(m1);

    // Busy loop
    const now = Date.now();
    while (Date.now() - now < 2000);

    performance.mark(m2);
    performance.measure('m', m1, m2);
    let entries = performance.getEntriesByName('m');
    t.equal(entries.length, 1, 'there should be 1 entry');
    const { duration } = entries[0];
    t.eq(typeof duration, 'number', 'entry duration is Number');
    const d = Math.round(duration);
    t.ok(d >= 1000 && d <= 2000, 'duration works');
    performance.clearMeasures();
    entries = performance.getEntriesByName('m');
    t.equal(entries.length, 0, 'there should be 0 entries');
});


if (import.meta.main) {
    run();
}
