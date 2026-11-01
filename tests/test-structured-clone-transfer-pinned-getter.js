import assert from 'tjs:assert';
import path from 'tjs:path';

// The buffer is not pinned when structuredClone validates the transfer list,
// but a getter run during serialization starts an fs write that pins it. The
// clone must be refused and no transfer-list buffer detached.

const SIZE = 1024 * 1024;
const data = new Uint8Array(SIZE);

for (let i = 0; i < SIZE; i++) {
    data[i] = i & 0xff;
}

const tmpDir = await tjs.makeTempDir(path.join(tjs.tmpDir, 'tjs-test-sc-pinned-getter-XXXXXX'));

try {
    const f = await tjs.open(path.join(tmpDir, 'out.bin'), 'w');
    const extra = new ArrayBuffer(8);

    // JS_WriteObject reads array elements through getters.
    let p;
    const value = [];

    Object.defineProperty(value, 0, {
        enumerable: true,
        get() {
            p = f.write(data);

            return 1;
        }
    });

    let err;

    try {
        structuredClone(value, { transfer: [ extra, data.buffer ] });
    } catch (e) {
        err = e;
    }

    assert.ok(p, 'the getter ran');
    assert.ok(err instanceof DOMException, 'clone refused with a DOMException');
    assert.eq(err.name, 'DataCloneError', 'clone refused with DataCloneError');
    assert.eq(data.buffer.detached, false, 'pinned buffer not detached');
    assert.eq(extra.byteLength, 8, 'other buffer in the refused transfer not detached');

    assert.eq(await p, SIZE, 'whole buffer written');
    await f.close();

    const back = await tjs.readFile(path.join(tmpDir, 'out.bin'));
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
    await tjs.remove(tmpDir, { recursive: true });
}
