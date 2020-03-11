import assert from './assert.js';


async function readWrite() {
    const f = await tjs.fs.mkstemp('test_fileXXXXXX');
    const path = f.path;
    await f.write('hello world');
    await f.write(' 42');
    await f.close();
    const f2 = await tjs.fs.open(path, 'r');
    const data = await f2.read(32);
    const dataStr = new TextDecoder().decode(data);
    assert.eq(dataStr, 'hello world 42');
    await f2.close();
    await tjs.fs.unlink(path);
};

async function mkstemp() {
    const f = await tjs.fs.mkstemp('test_fileXXXXXX');
    t.ok(f.path, 'file was created ok');
    await f.write('hello world');
    const path = f.path;
    await f.close();
    const f2 = await tjs.fs.open(path, 'r');
    const data = await f2.read(32);
    const dataStr = new TextDecoder().decode(data);
    t.eq(dataStr, 'hello world');
    await f2.close();
    await tjs.fs.unlink(path);
};


(async () => {
    await readWrite();
    await mkstemp();
})();
