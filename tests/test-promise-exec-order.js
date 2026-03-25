import assert from 'tjs:assert';

// Test 1: Microtasks from listener 1 run before listener 2 (browser behavior).
const order = [];
const target = new EventTarget();

target.addEventListener('test', () => {
    order.push(1);
    Promise.resolve().then(() => order.push(2));
});
target.addEventListener('test', () => {
    order.push(3);
    Promise.resolve().then(() => order.push(4));
});

target.dispatchEvent(new Event('test'));

// Browser order: 1, 2, 3, 4
// Before fix:    1, 3, 2, 4
assert.eq(order.length, 4, 'all callbacks and microtasks should have run');
assert.eq(order[0], 1, 'listener 1 runs first');
assert.eq(order[1], 2, 'microtask from listener 1 runs before listener 2');
assert.eq(order[2], 3, 'listener 2 runs third');
assert.eq(order[3], 4, 'microtask from listener 2 runs last');

// Test 2: Microtasks from setTimeout callbacks run before the next timer.
const timerOrder = [];

await new Promise(resolve => {
    setTimeout(() => {
        timerOrder.push('a');
        Promise.resolve().then(() => timerOrder.push('b'));
    }, 0);
    setTimeout(() => {
        timerOrder.push('c');
        Promise.resolve().then(() => {
            timerOrder.push('d');
            resolve();
        });
    }, 0);
});

assert.eq(timerOrder.join(','), 'a,b,c,d', 'microtasks drain between timers');
