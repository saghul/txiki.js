import assert from 'tjs:assert';

// Skipped under GC stress: forcing a full GC before every allocation starves
// the event loop, so the wall-clock timing this test relies on no longer holds.
if (tjs.env.TJS_GC_STRESS) {
    tjs.exit(0);
}

const LIMIT = 2000;
const THRESHOLD = 25;

// Timers may fire up to one event-loop clock tick early, since the loop
// clock is coarser than performance.now() (~16ms on Windows).
const TIMER_SLACK = 20;

async function sleep(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}


// performance now

const wallStart = Date.now();
const start = performance.now();
assert.eq(typeof start, 'number', 'performance.now() returns Number');

// wait
await sleep(LIMIT);

const perfDiff = performance.now() - start;
const wallDiff = Date.now() - wallStart;
assert.ok(perfDiff >= LIMIT - TIMER_SLACK, 'performance.now() advances by at least the timer delay');
assert.ok(Math.abs(perfDiff - wallDiff) < THRESHOLD, 'performance.now() tracks wall-clock time');


// performance mark

const m1 = 'mark1';
const m2 = 'mark2';
performance.mark(m1);
const t1 = performance.now();

// wait
await sleep(LIMIT);

performance.mark(m2);
const t2 = performance.now();
performance.measure('m', m1, m2);
let entries = performance.getEntriesByName('m');
assert.equal(entries.length, 1, 'there should be 1 entry');
const { duration } = entries[0];
assert.eq(typeof duration, 'number', 'entry duration is Number');
assert.ok(duration >= LIMIT - TIMER_SLACK, 'duration is at least the timer delay');
assert.ok(Math.abs(duration - (t2 - t1)) < THRESHOLD, 'duration matches performance.now() over the same interval');
performance.clearMeasures();
entries = performance.getEntriesByName('m');
assert.equal(entries.length, 0, 'there should be 0 entries');
