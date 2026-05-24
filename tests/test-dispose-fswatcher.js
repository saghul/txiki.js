import assert from 'tjs:assert';
import path from 'tjs:path';

async function sleep(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

// `using` closes the watcher when the block exits.
{
    const tmpDir = await tjs.makeTempDir('test-dispose-fswatcher-XXXXXX');

    try {
        const state = { afterDispose: false, eventsAfterDispose: 0 };

        {
            using watcher = tjs.watch(tmpDir, () => {
                if (state.afterDispose) {
                    state.eventsAfterDispose++;
                }
            });

            // Reference watcher to ensure no unused-binding lint issue.
            assert.ok(watcher);

            // Give the watcher a moment to start.
            await sleep(100);
        }

        // The watcher should be closed; subsequent filesystem activity must
        // not fire the callback.
        state.afterDispose = true;
        await tjs.writeFile(path.join(tmpDir, 'extra'), new Uint8Array([ 42 ]));
        await sleep(200);

        assert.eq(state.eventsAfterDispose, 0, 'disposed watcher does not fire');
    } finally {
        await tjs.remove(tmpDir);
    }
}

// Manual close followed by dispose is a no-op (idempotent).
{
    const tmpDir = await tjs.makeTempDir('test-dispose-fswatcher-XXXXXX');

    try {
        const watcher = tjs.watch(tmpDir, () => {});

        watcher.close();

        // Second close via dispose must not throw.
        watcher[Symbol.dispose]();

        // Third manual close must also be a no-op.
        watcher.close();
    } finally {
        await tjs.remove(tmpDir);
    }
}

// dispose method exists and is callable.
{
    const tmpDir = await tjs.makeTempDir('test-dispose-fswatcher-XXXXXX');

    try {
        const watcher = tjs.watch(tmpDir, () => {});
        const ret = watcher[Symbol.dispose]();

        assert.eq(ret, undefined, '[Symbol.dispose] returns undefined');
    } finally {
        await tjs.remove(tmpDir);
    }
}

// dispose property is non-enumerable.
{
    const tmpDir = await tjs.makeTempDir('test-dispose-fswatcher-XXXXXX');

    try {
        const watcher = tjs.watch(tmpDir, () => {});
        const proto = Object.getPrototypeOf(watcher);
        const desc = Object.getOwnPropertyDescriptor(proto, Symbol.dispose);

        assert.ok(desc, 'descriptor exists on prototype');
        assert.eq(desc.enumerable, false, 'dispose is non-enumerable');
        assert.eq(desc.configurable, true, 'dispose is configurable');
        assert.eq(desc.writable, true, 'dispose is writable');

        watcher.close();
    } finally {
        await tjs.remove(tmpDir);
    }
}
