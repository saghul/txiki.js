import assert from 'tjs:assert';

// Transferring a port through its OWN entangled partner must not leak the channel
// (regression: the transfer message would land in a mailbox it holds a ref to,
// forming an uncollectable refcount cycle). LeakSanitizer (Linux ASAN CI) asserts
// no leak; here we assert the disentangle semantics.

const { port1, port2 } = new MessageChannel();

// Ship port2's own partner (port1) through port2. The message is undeliverable
// (its target got disentangled by the transfer) and is discarded.
port2.postMessage('hi', [ port1 ]);

// The transfer neutered port1 on this side.
assert.throws(() => port1.postMessage('x'), Error, 'transferred port is detached');

port2.close();
