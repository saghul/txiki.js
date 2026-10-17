import assert from 'tjs:assert';
import path from 'tjs:path';

// A buffer pinned by an in-flight native write must not be transferred
// (detached) through a MessagePort: the I/O would read freed memory. An fs
// write pins deterministically (it runs on the threadpool and its completion
// can't run before the loop iterates), and the transfer guard doesn't care
// which I/O pinned the buffer.

const SIZE = 4 * 1024 * 1024;
const data = new Uint8Array(SIZE);

for (let i = 0; i < SIZE; i++) {
    data[i] = i & 0xff;
}

const tmpDir = await tjs.makeTempDir(path.join(tjs.tmpDir, 'tjs-test-mc-pinned-XXXXXX'));
const file = path.join(tmpDir, 'out.bin');
const { port1, port2 } = new MessageChannel();

try {
    const f = await tjs.open(file, 'w');
    const p = f.write(data);
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

    assert.eq(await p, SIZE, 'whole buffer written');
    await f.close();

    // The write released its pin, so the buffer can be transferred now. A hang
    // is left to the runner's per-test timeout: an ad-hoc timer here could fire
    // before delivery if a long synchronous section ran in the same loop tick.
    const msg = await new Promise(resolve => {
        port2.onmessage = e => resolve(e.data);
        port1.postMessage(data.buffer, [ data.buffer ]);
    });

    assert.eq(data.buffer.detached, true, 'buffer detached after the write completed');
    assert.eq(msg.byteLength, SIZE, 'transferred buffer arrives whole');

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
    port1.close();
    port2.close();
    await tjs.remove(tmpDir, { recursive: true });
}
