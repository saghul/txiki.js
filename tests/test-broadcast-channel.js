import assert from 'tjs:assert';

// Same-thread BroadcastChannel: fan-out to other channels with the same name,
// excluding the sender and other names.

assert.eq(typeof BroadcastChannel, 'function', 'BroadcastChannel is a global');

const a = new BroadcastChannel('room');
const b = new BroadcastChannel('room');
const c = new BroadcastChannel('other-room');

assert.eq(a.name, 'room', 'name property');
assert.eq(Object.prototype.toString.call(a), '[object BroadcastChannel]', 'BroadcastChannel tag');

const onA = [];
const onB = [];
const onC = [];

a.onmessage = e => onA.push(e.data);
c.onmessage = e => onC.push(e.data);

await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), 3000);
    let n = 0;

    b.onmessage = e => {
        onB.push(e.data);

        if (++n === 2) {
            clearTimeout(timer);
            resolve();
        }
    };

    a.postMessage('one');
    a.postMessage({ two: 2 });
});

assert.eq(onB.length, 2, 'same-name channel received both messages');
assert.eq(onB[0], 'one', 'first message');
assert.eq(onB[1].two, 2, 'second (cloned) message');
assert.eq(onA.length, 0, 'sender does not receive its own message');
assert.eq(onC.length, 0, 'different-name channel does not receive');

a.close();
b.close();
c.close();

// Posting on a closed channel throws.
assert.throws(() => a.postMessage('x'), Error, 'postMessage on closed BroadcastChannel throws');
