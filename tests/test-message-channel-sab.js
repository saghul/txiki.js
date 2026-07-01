import assert from 'tjs:assert';

// A SharedArrayBuffer sent through a MessagePort is shared (not copied): both
// sides observe writes to the same backing memory.

const { port1, port2 } = new MessageChannel();

const sab = new SharedArrayBuffer(8);
const view = new Int32Array(sab);

Atomics.store(view, 0, 111);

const received = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), 3000);

    port2.onmessage = e => {
        clearTimeout(timer);
        resolve(e.data);
    };

    port1.postMessage(sab);
});

assert.ok(received instanceof SharedArrayBuffer, 'received a SharedArrayBuffer');

const receivedView = new Int32Array(received);

assert.eq(Atomics.load(receivedView, 0), 111, 'initial value visible on the other side');

// Because the memory is shared, a write through the original is seen via the
// received buffer.
Atomics.store(view, 1, 222);
assert.eq(Atomics.load(receivedView, 1), 222, 'writes are shared across the channel');

port1.close();
port2.close();
