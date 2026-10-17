import assert from 'tjs:assert';

import { SIZE, connectedPair, firstBadByte, makeData, readAll } from './helpers/pinned-tcp.js';

// A buffer pinned by an in-flight TCP write must not be transferred (detached)
// through a MessagePort: libuv would send freed memory to the peer.

const pair = await connectedPair();
const data = makeData();
const p = pair.writer.write(data);

assert.eq(data.buffer.immutable, true, 'precondition: write in flight, buffer pinned');

const { port1, port2 } = new MessageChannel();
let err;

try {
    port1.postMessage(null, [ data.buffer ]);
} catch (e) {
    err = e;
}

assert.ok(err instanceof DOMException, 'transfer refused with a DOMException');
assert.eq(err.name, 'DataCloneError', 'transfer refused with DataCloneError');
assert.eq(data.buffer.detached, false, 'pinned buffer not detached');
assert.eq(data.buffer.byteLength, SIZE, 'pinned buffer keeps its length');

const received = readAll(pair.readable);

await p;
await pair.writer.close();

const buf = await received;

// The write released its pin, so the buffer can be transferred now.
const msg = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), 3000);

    port2.onmessage = e => {
        clearTimeout(timer);
        resolve(e.data);
    };

    port1.postMessage(data.buffer, [ data.buffer ]);
});

assert.eq(data.buffer.detached, true, 'buffer detached after the write completed');
assert.eq(msg.byteLength, SIZE, 'transferred buffer arrives whole');

assert.eq(buf.length, SIZE, 'peer got every byte');
assert.eq(firstBadByte(buf), -1, 'peer got intact bytes');

port1.close();
port2.close();
pair.close();
