// new Blob() must accept parts whose buffer is pinned by an in-flight native
// write, and copy exactly the viewed bytes.
import assert from 'tjs:assert';
import path from 'tjs:path';

function assertBytes(actual, expected, what) {
    assert.eq(actual.byteLength, expected.byteLength, `${what}: length`);

    for (let i = 0; i < expected.byteLength; i++) {
        if (actual[i] !== expected[i]) {
            assert.fail(`${what}: byte ${i} is ${actual[i]}, expected ${expected[i]}`);
        }
    }
}

const data = new Uint8Array(16 * 1024 * 1024);

for (let i = 0; i < data.length; i++) {
    data[i] = (i * 31 + (i >> 8)) & 0xff;
}

const viewOff = 4097;
const viewLen = 3 * 65536 + 123;
const dvOff = 77;
const dvLen = 1000;
const copy = data.slice();

const f = await tjs.makeTempFile(path.join(tjs.tmpDir, 'tjs-buf-pin-XXXXXX'));
const fpath = f.path;

try {
    const w = f.write(data);

    assert.ok(data.buffer.immutable, 'buffer is pinned by the in-flight write');

    const viewBlob = new Blob([ data.subarray(viewOff, viewOff + viewLen) ]);
    const abBlob = new Blob([ data.buffer ]);
    const dvBlob = new Blob([ new DataView(data.buffer, dvOff, dvLen) ]);

    assert.ok(data.buffer.immutable, 'buffer still pinned after the Blobs were built');

    await w;

    assert.ok(!data.buffer.immutable, 'buffer released after the write');

    const st = await f.stat();

    assert.eq(st.size, data.length);

    assertBytes(new Uint8Array(await viewBlob.arrayBuffer()), copy.subarray(viewOff, viewOff + viewLen), 'view part');
    assertBytes(new Uint8Array(await abBlob.arrayBuffer()), copy, 'ArrayBuffer part');
    assertBytes(new Uint8Array(await dvBlob.arrayBuffer()), copy.subarray(dvOff, dvOff + dvLen), 'DataView part');

    const chunks = [];

    for await (const chunk of viewBlob.stream()) {
        chunks.push(chunk);
    }

    assert.ok(chunks.length > 1, 'stream() splits a large part into several chunks');

    const streamed = new Uint8Array(viewLen);
    let pos = 0;

    for (const chunk of chunks) {
        streamed.set(chunk, pos);
        pos += chunk.byteLength;
    }

    assertBytes(streamed.subarray(0, pos), copy.subarray(viewOff, viewOff + viewLen), 'streamed view part');
} finally {
    await f.close();
    await tjs.remove(fpath);
}
