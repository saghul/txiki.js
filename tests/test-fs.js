import assert from './assert.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();


async function readWrite() {
    const f = await tjs.mkstemp('test_fileXXXXXX');
    const path = f.path;
    await f.write(encoder.encode('hello world'));
    await f.write(encoder.encode(' 42'));
    await f.close();
    const f2 = await tjs.open(path, 'r');
    const buf = new Uint8Array(32);
    const nread = await f2.read(buf);
    const dataStr = decoder.decode(buf.subarray(0, nread));
    assert.eq(dataStr, 'hello world 42');
    await f2.close();
    await tjs.unlink(path);
};

async function mkstemp() {
    const f = await tjs.mkstemp('test_fileXXXXXX');
    assert.ok(f.path, 'file was created ok');
    await f.write(encoder.encode('hello world'));
    const path = f.path;
    await f.close();
    const f2 = await tjs.open(path, 'r');
    const buf = new Uint8Array(32);
    const nread = await f2.read(buf);
    const dataStr = decoder.decode(buf.subarray(0, nread));
    assert.eq(dataStr, 'hello world');
    await f2.close();
    await tjs.unlink(path);
};


(async () => {
    await readWrite();
    await mkstemp();
})();
