import assert from 'tjs:assert';

// postMessage clones the message (structured clone), and rejects non-cloneable values.

const { port1, port2 } = new MessageChannel();

const original = { n: 1, nested: { a: [ 1, 2, 3 ] } };

const received = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), 3000);

    port2.onmessage = e => {
        clearTimeout(timer);
        resolve(e.data);
    };
    port1.postMessage(original);
    // Mutating after posting must not affect what the receiver gets.
    original.n = 999;
});

assert.eq(received.n, 1, 'message is a snapshot taken at post time');
assert.eq(received.nested.a[2], 3, 'nested structure cloned');
assert.ok(received !== original, 'received is a distinct object');

// Functions and other non-cloneable values throw DataCloneError.
assert.throws(() => port1.postMessage(() => {}), Error, 'function is not cloneable');

port1.close();
port2.close();
