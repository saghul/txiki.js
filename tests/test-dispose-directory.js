import assert from 'tjs:assert';
import path from 'tjs:path';

// `await using` closes the directory when the block exits.
{
    const tmpDir = await tjs.makeTempDir('test-dispose-dir-XXXXXX');

    try {
        for (let i = 0; i < 3; i++) {
            await tjs.writeFile(path.join(tmpDir, `f${i}`), new Uint8Array([ i ]));
        }

        let captured;

        await (async () => {
            await using dir = await tjs.readDir(tmpDir);

            captured = dir;

            // Iterate a couple of entries to ensure the dir is actually usable.
            let count = 0;

            for await (const item of dir) {
                assert.ok(typeof item.name === 'string', 'entry has a name');
                count++;
                if (count >= 2) {
                    break;
                }
            }

            assert.ok(count > 0, 'iterated at least one entry');
        })();

        // After the block, dir is closed. next() must reject.
        let threw = false;

        try {
            await captured.next();
        } catch (e) {
            threw = true;
        }

        assert.ok(threw, 'next() on disposed directory rejects');
    } finally {
        await tjs.remove(tmpDir);
    }
}

// Manual close followed by dispose is a no-op (idempotent).
{
    const tmpDir = await tjs.makeTempDir('test-dispose-dir-XXXXXX');

    try {
        const dir = await tjs.readDir(tmpDir);

        await dir.close();

        // Second close via dispose must not throw.
        await dir[Symbol.asyncDispose]();

        // Third manual close must also be a no-op.
        await dir.close();
    } finally {
        await tjs.remove(tmpDir);
    }
}

// asyncDispose returns a Promise.
{
    const tmpDir = await tjs.makeTempDir('test-dispose-dir-XXXXXX');

    try {
        const dir = await tjs.readDir(tmpDir);
        const ret = dir[Symbol.asyncDispose]();

        assert.ok(ret instanceof Promise, '[Symbol.asyncDispose] returns a Promise');
        await ret;
    } finally {
        await tjs.remove(tmpDir);
    }
}

// asyncDispose property is non-enumerable.
{
    const tmpDir = await tjs.makeTempDir('test-dispose-dir-XXXXXX');

    try {
        const dir = await tjs.readDir(tmpDir);
        const proto = Object.getPrototypeOf(dir);
        const desc = Object.getOwnPropertyDescriptor(proto, Symbol.asyncDispose);

        assert.ok(desc, 'descriptor exists on prototype');
        assert.eq(desc.enumerable, false, 'asyncDispose is non-enumerable');
        assert.eq(desc.configurable, true, 'asyncDispose is configurable');
        assert.eq(desc.writable, true, 'asyncDispose is writable');

        await dir.close();
    } finally {
        await tjs.remove(tmpDir);
    }
}
