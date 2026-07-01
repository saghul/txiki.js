import assert from 'tjs:assert';

// close() disentangles the port: subsequent posts to the closed peer are dropped
// and posting on a closed port throws.

const { port1, port2 } = new MessageChannel();

let count = 0;
const firstDelivered = Promise.withResolvers();

port2.onmessage = () => {
    count++;
    firstDelivered.resolve();
};

port1.postMessage('first');

// Await the actual delivery, not a fixed sleep: under GC stress the event loop
// is starved and a wall-clock timeout races (and loses to) the async delivery.
await firstDelivered.promise;
assert.eq(count, 1, 'first message delivered');

port2.close();
port1.postMessage('after-close'); // dropped silently (peer closed)

await new Promise(resolve => setTimeout(resolve, 100));
assert.eq(count, 1, 'no delivery after peer close');

// Posting on a detached (closed) port throws.
assert.throws(() => port2.postMessage('x'), Error, 'postMessage on closed port throws');

port1.close();
