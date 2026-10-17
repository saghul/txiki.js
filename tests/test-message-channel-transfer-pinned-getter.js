import assert from 'tjs:assert';

import { SIZE, connectedPair, firstBadByte, makeData, readAll } from './helpers/pinned-tcp.js';

// The buffer is not pinned when postMessage validates the transfer list, but a
// getter run while the message is serialized starts a TCP write that pins it.
// The transfer must still be refused, with nothing transferred.

const pair = await connectedPair();
const data = makeData();
const extra = new ArrayBuffer(8);
const inner = new MessageChannel();
const { port1, port2 } = new MessageChannel();

let p;
const msg = [];

Object.defineProperty(msg, 0, {
    enumerable: true,
    get() {
        p = pair.writer.write(data);

        return 1;
    }
});

assert.throws(
    () => port1.postMessage(msg, [ extra, data.buffer, inner.port2 ]),
    TypeError,
    'transfer of a buffer pinned during serialization is refused');
assert.ok(p, 'the getter ran');
assert.eq(data.buffer.detached, false, 'pinned buffer not detached');
assert.eq(data.buffer.byteLength, SIZE, 'pinned buffer keeps its length');
assert.eq(extra.byteLength, 8, 'other buffer in the refused transfer not detached');

const received = readAll(pair.readable);

await p;
await pair.writer.close();

const buf = await received;

// The port listed in the refused transfer was not transferred and still works.
const innerMsg = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), 3000);

    inner.port1.onmessage = e => {
        clearTimeout(timer);
        resolve(e.data);
    };

    inner.port2.postMessage('still here');
});

assert.eq(innerMsg, 'still here', 'port from the refused transfer still usable');

assert.eq(buf.length, SIZE, 'peer got every byte');
assert.eq(firstBadByte(buf), -1, 'peer got intact bytes');

inner.port1.close();
inner.port2.close();
port1.close();
port2.close();
pair.close();
