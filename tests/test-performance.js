import assert from './assert.js';


// performance now

const start = performance.now();
assert.eq(typeof start, 'number', 'performance.now() returns Number');

let now;

// Busy loop
now = Date.now();
while (Date.now() - now < 2000);

const diff = Math.round(performance.now() - start);
assert.ok(diff >= 1000 && diff <= 2000, 'performance.now() works');


// performance mark

const m1 = 'mark1';
const m2 = 'mark2';
performance.mark(m1);

// Busy loop
now = Date.now();
while (Date.now() - now < 2000);

performance.mark(m2);
performance.measure('m', m1, m2);
let entries = performance.getEntriesByName('m');
assert.equal(entries.length, 1, 'there should be 1 entry');
const { duration } = entries[0];
assert.eq(typeof duration, 'number', 'entry duration is Number');
const d = Math.round(duration);
assert.ok(d >= 1000 && d <= 2000, 'duration works');
performance.clearMeasures();
entries = performance.getEntriesByName('m');
assert.equal(entries.length, 0, 'there should be 0 entries');
