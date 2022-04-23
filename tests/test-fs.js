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

async function mkdir() {
    const path = `./test_mkdir${tjs.pid}`;
    const s_irwxu = 0o700;
    const s_ifmt = ~0o777;
    await tjs.mkdir(path, s_irwxu);
    const result = await tjs.stat(path);
    assert.ok(result.isDirectory, 'directory was created ok');
    /* NOTE: File permission mode not supported on Windows. */
    if (tjs.platform !== 'windows')
      assert.eq(result.mode & ~s_ifmt, s_irwxu);
    await tjs.rmdir(path);
};

async function chmod() {
    /* NOTE: File permission mode not supported on Windows. */
    if (tjs.platform === 'windows')
      return;

    const path = `./test_mkdir${tjs.pid}`;
    const s_irwxu = 0o700;
    const s_irwxg = 0o070;
    const s_ifmt = ~0o777;
    await tjs.mkdir(path, s_irwxu);
    await tjs.chmod(path, s_irwxu | s_irwxg);

    const result = await tjs.stat(path);
    assert.eq(result.mode & ~s_ifmt, s_irwxu | s_irwxg);
    await tjs.rmdir(path);
};

(async () => {
    await readWrite();
    await mkstemp();
    await mkdir();
    await chmod();
})();
