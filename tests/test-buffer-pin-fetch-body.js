// new Response() must accept an ArrayBuffer body that is pinned by an
// in-flight native write, and keep its bytes.
import assert from 'tjs:assert';
import path from 'tjs:path';

const data = new Uint8Array(16 * 1024 * 1024);

for (let i = 0; i < data.length; i++) {
    data[i] = (i * 13 + (i >> 12)) & 0xff;
}

const copy = data.slice();

const f = await tjs.makeTempFile(path.join(tjs.tmpDir, 'tjs-buf-pin-XXXXXX'));
const fpath = f.path;

try {
    const w = f.write(data);

    assert.ok(data.buffer.immutable, 'buffer is pinned by the in-flight write');

    const res = new Response(data.buffer);

    assert.ok(data.buffer.immutable, 'buffer still pinned after the Response was built');

    await w;

    assert.ok(!data.buffer.immutable, 'buffer released after the write');

    const st = await f.stat();

    assert.eq(st.size, data.length);

    const body = new Uint8Array(await res.arrayBuffer());

    assert.eq(body.byteLength, data.length, 'body length');

    for (const i of [ 0, 1, 4095, 65536, 1234567, data.length >> 1, data.length - 1 ]) {
        assert.eq(body[i], copy[i], `body byte ${i}`);
    }
} finally {
    await f.close();
    await tjs.remove(fpath);
}
