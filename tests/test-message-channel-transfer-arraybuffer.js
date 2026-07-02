import assert from 'tjs:assert';

// Transferring an ArrayBuffer detaches the source; the content is preserved on
// the receiving side.

const { port1, port2 } = new MessageChannel();

const ab = new ArrayBuffer(4);
new Uint8Array(ab).set([ 10, 20, 30, 40 ]);

const received = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), 3000);

    port2.onmessage = e => {
        clearTimeout(timer);
        resolve(e.data);
    };

    port1.postMessage(ab, [ ab ]);

    assert.eq(ab.byteLength, 0, 'source ArrayBuffer detached after transfer');
});

assert.ok(received instanceof ArrayBuffer, 'received an ArrayBuffer');
assert.eq(received.byteLength, 4, 'byteLength preserved');
assert.eq(Array.from(new Uint8Array(received)).join(','), '10,20,30,40', 'content preserved');

port1.close();
port2.close();
