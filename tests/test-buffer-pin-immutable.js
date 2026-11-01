// A buffer made immutable with transferToImmutable() must stay immutable after
// native requests pin and release it, alone or overlapping.
import assert from 'tjs:assert';
import path from 'tjs:path';

const buf = new Uint8Array([ 1, 2, 3, 4, 5, 6, 7, 8 ]).buffer.transferToImmutable();
const data = new Uint8Array(buf);

assert.ok(buf.immutable);

const f = await tjs.makeTempFile(path.join(tjs.tmpDir, 'tjs-buf-pin-XXXXXX'));
const fpath = f.path;

try {
    await f.write(data);

    assert.ok(buf.immutable, 'still immutable after one pin is released');

    await Promise.all([ f.write(data), f.write(data) ]);

    assert.ok(buf.immutable, 'still immutable after two overlapping pins are released');
    assert.throws(() => buf.transfer(), TypeError, 'transfer() still rejected');

    const st = await f.stat();

    assert.eq(st.size, 24);
} finally {
    await f.close();
    await tjs.remove(fpath);
}
