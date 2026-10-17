import assert from 'tjs:assert';

// An immutable ArrayBuffer cannot be transferred: postMessage throws
// DataCloneError and nothing in the transfer list is transferred.

const imm = new ArrayBuffer(8).transferToImmutable();
const extra = new ArrayBuffer(8);
const inner = new MessageChannel();
const { port1, port2 } = new MessageChannel();
let err;

try {
    port1.postMessage(null, [ extra, imm, inner.port2 ]);
} catch (e) {
    err = e;
}

assert.ok(err instanceof DOMException, 'transfer refused with a DOMException');
assert.eq(err.name, 'DataCloneError', 'transfer refused with DataCloneError');
assert.eq(imm.detached, false, 'immutable buffer not detached');
assert.eq(extra.byteLength, 8, 'other buffer not detached');

const data = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), 3000);

    inner.port1.onmessage = e => {
        clearTimeout(timer);
        resolve(e.data);
    };

    inner.port2.postMessage('still here');
});

assert.eq(data, 'still here', 'port from the refused transfer still usable');

inner.port1.close();
inner.port2.close();
port1.close();
port2.close();
