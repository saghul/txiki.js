import assert from 'tjs:assert';
import path from 'tjs:path';

const dirs = [ 'advanced', 'fixtures', 'helpers', 'wasi', 'wasm' ];

const dirIter = await tjs.readDir(import.meta.dirname);

for await (const item of dirIter) {
    const { name } = item;
    if (name in dirs) {
        assert.ok(item.isDir);
        assert.notOk(item.isFIFO);
    } else if (name.startsWith('test-') && name.endsWith('.js')) {
        assert.ok(item.isFile);
        assert.notOk(item.isSocket);
    }
}

await dirIter.close();

// Overlapping dir.next() calls must not race on the shared dirent slot.
// Concurrent calls throw synchronously; the first
// in-flight read still completes.
const tmpDir = await tjs.makeTempDir('test-fs-readdir-XXXXXX');
try {
    for (let i = 0; i < 8; i++) {
        await tjs.writeFile(path.join(tmpDir, `entry-${i}`), new Uint8Array([ i ]));
    }

    const iter = await tjs.readDir(tmpDir);
    const pending = iter.next();
    assert.throws(() => iter.next(), TypeError);
    assert.notOk((await pending).done);

    // After the in-flight read completes, next() works again.
    assert.ok(await iter.next());

    await iter.close();
} finally {
    await tjs.remove(tmpDir);
}
