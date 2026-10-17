import assert from 'tjs:assert';
import path from 'tjs:path';

// The buffer is not pinned when postMessage validates the transfer list, but a
// getter run while the message is serialized starts an fs write that pins it.
// The transfer must still be refused, with nothing transferred.

const SIZE = 1024 * 1024;
const data = new Uint8Array(SIZE);

for (let i = 0; i < SIZE; i++) {
    data[i] = i & 0xff;
}

const tmpDir = await tjs.makeTempDir(path.join(tjs.tmpDir, 'tjs-test-mc-pinned-getter-XXXXXX'));
const file = path.join(tmpDir, 'out.bin');
const extra = new ArrayBuffer(8);
const inner = new MessageChannel();
const { port1, port2 } = new MessageChannel();

try {
    const f = await tjs.open(file, 'w');

    // JS_WriteObject reads array elements through getters.
    let p;
    const msg = [];

    Object.defineProperty(msg, 0, {
        enumerable: true,
        get() {
            p = f.write(data);

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

    assert.eq(await p, SIZE, 'whole buffer written');
    await f.close();

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

    const back = await tjs.readFile(file);
    let bad = -1;

    for (let i = 0; i < SIZE; i++) {
        if (back[i] !== (i & 0xff)) {
            bad = i;
            break;
        }
    }

    assert.eq(back.length, SIZE, 'file size');
    assert.eq(bad, -1, 'file contents intact');
} finally {
    inner.port1.close();
    inner.port2.close();
    port1.close();
    port2.close();
    await tjs.remove(tmpDir, { recursive: true });
}
