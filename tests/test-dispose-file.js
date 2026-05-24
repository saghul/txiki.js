import assert from 'tjs:assert';
import path from 'tjs:path';

const encoder = new TextEncoder();

// `await using` closes the file when the block exits.
{
    const tmpDir = await tjs.makeTempDir('test-dispose-file-XXXXXX');

    try {
        const filePath = path.join(tmpDir, 'data.txt');
        let captured;

        await (async () => {
            await using f = await tjs.open(filePath, 'w');

            captured = f;
            await f.write(encoder.encode('hello'));
        })();

        // After the block, the underlying handle should be closed; further
        // reads/writes through the same proxy must reject.
        let threw = false;

        try {
            await captured.write(encoder.encode('again'));
        } catch (e) {
            threw = true;
        }

        assert.ok(threw, 'write on disposed file rejects');
    } finally {
        await tjs.remove(tmpDir);
    }
}

// Manual close followed by dispose is a no-op (idempotent).
{
    const tmpDir = await tjs.makeTempDir('test-dispose-file-XXXXXX');

    try {
        const filePath = path.join(tmpDir, 'data.txt');
        const f = await tjs.open(filePath, 'w');

        await f.close();

        // Second close via dispose must not throw.
        await f[Symbol.asyncDispose]();

        // Third manual close must also be a no-op.
        await f.close();
    } finally {
        await tjs.remove(tmpDir);
    }
}

// asyncDispose returns a Promise.
{
    const tmpDir = await tjs.makeTempDir('test-dispose-file-XXXXXX');

    try {
        const filePath = path.join(tmpDir, 'data.txt');
        const f = await tjs.open(filePath, 'w');
        const ret = f[Symbol.asyncDispose]();

        assert.ok(ret instanceof Promise, '[Symbol.asyncDispose] returns a Promise');
        await ret;
    } finally {
        await tjs.remove(tmpDir);
    }
}

// asyncDispose property is non-enumerable.
{
    const tmpDir = await tjs.makeTempDir('test-dispose-file-XXXXXX');

    try {
        const f = await tjs.open(path.join(tmpDir, 'data.txt'), 'w');
        const proto = Object.getPrototypeOf(f);
        const desc = Object.getOwnPropertyDescriptor(proto, Symbol.asyncDispose);

        assert.ok(desc, 'descriptor exists on prototype');
        assert.eq(desc.enumerable, false, 'asyncDispose is non-enumerable');
        assert.eq(desc.configurable, true, 'asyncDispose is configurable');
        assert.eq(desc.writable, true, 'asyncDispose is writable');

        await f.close();
    } finally {
        await tjs.remove(tmpDir);
    }
}
