import assert from 'tjs:assert';

// Transfer-list validation: duplicates and non-transferables are rejected, and a
// rejected transfer must not have transferred anything (atomicity).

const { port1, port2 } = new MessageChannel();
const other = new MessageChannel();

// The same port listed twice must throw DataCloneError.
assert.throws(
    () => port1.postMessage('x', [ other.port1, other.port1 ]),
    Error,
    'duplicate transferable throws'
);

// A non-transferable value must throw DataCloneError.
assert.throws(() => port1.postMessage('x', [ {} ]), Error, 'non-transferable throws');

// After those throws, other.port1 must NOT have been transferred (still usable).
const roundtrip = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), 3000);

    other.port2.onmessage = e => {
        clearTimeout(timer);
        resolve(e.data);
    };
    other.port1.postMessage('still-works');
});

assert.eq(roundtrip, 'still-works', 'ports untouched after a rejected transfer');

port1.close();
port2.close();
other.port1.close();
other.port2.close();
