// Regression test: stat fields must not be truncated to 32 bits.
// A sparse file larger than 4 GiB must report its true size, not size mod 2**32.
import assert from 'tjs:assert';

const big = 5 * 1024 * 1024 * 1024; // 5 GiB, well above the 2**32 wrap point

const f = await tjs.makeTempFile('test_stat_largeXXXXXX');
const path = f.path;
try {
    await f.truncate(big);

    const st1 = await f.stat();
    assert.eq(st1.size, big, 'FileHandle.stat().size must preserve values above 4 GiB');

    const st2 = await tjs.stat(path);
    assert.eq(st2.size, big, 'tjs.stat().size must preserve values above 4 GiB');
} finally {
    await f.close();
    await tjs.remove(path);
}
