import assert from 'tjs:assert';
import path from 'tjs:path';

// A buffer pinned by an in-flight fs write must not be transferred (detached):
// the threadpool would read freed memory. Once the write completes the buffer
// is transferable again.

function assertDataCloneError(fn, description) {
    let err;

    try {
        fn();
    } catch (e) {
        err = e;
    }

    assert.ok(err instanceof DOMException, description);
    assert.eq(err.name, 'DataCloneError', description);
}

const SIZE = 4 * 1024 * 1024;
const data = new Uint8Array(SIZE);

for (let i = 0; i < SIZE; i++) {
    data[i] = i & 0xff;
}

const tmpDir = await tjs.makeTempDir(path.join(tjs.tmpDir, 'tjs-test-sc-pinned-XXXXXX'));
const file = path.join(tmpDir, 'out.bin');

try {
    const f = await tjs.open(file, 'w');
    const p = f.write(data);

    assertDataCloneError(
        () => structuredClone(null, { transfer: [ data.buffer ] }),
        'transferring a pinned buffer throws DataCloneError');
    assert.eq(data.buffer.detached, false, 'pinned buffer not detached');
    assert.eq(data.buffer.byteLength, SIZE, 'pinned buffer keeps its length');

    // A refused transfer detaches nothing, not even the buffers listed before it.
    const other = new ArrayBuffer(8);

    assertDataCloneError(() => structuredClone(null, { transfer: [ other, data.buffer ] }));
    assert.eq(other.byteLength, 8, 'other buffer in a refused transfer not detached');

    assert.eq(await p, SIZE, 'whole buffer written');
    await f.close();

    const back = await tjs.readFile(file);

    assert.eq(back.length, SIZE, 'file size');

    let bad = -1;

    for (let i = 0; i < SIZE; i++) {
        if (back[i] !== (i & 0xff)) {
            bad = i;
            break;
        }
    }

    assert.eq(bad, -1, 'file contents intact');

    // The write released its pin, so the buffer can be transferred now.
    const clone = structuredClone(data.buffer, { transfer: [ data.buffer ] });

    assert.eq(data.buffer.detached, true, 'buffer detached after the write completed');
    assert.eq(clone.byteLength, SIZE, 'clone has the contents');
} finally {
    await tjs.remove(tmpDir, { recursive: true });
}

// A genuinely immutable buffer is not transferable either.
const imm = new ArrayBuffer(8).transferToImmutable();

assertDataCloneError(
    () => structuredClone(null, { transfer: [ imm ] }),
    'transferring an immutable buffer throws DataCloneError');
assert.eq(imm.detached, false, 'immutable buffer not detached');
assert.eq(imm.byteLength, 8);
