import assert from 'tjs:assert';
import path from 'tjs:path';

// Test that a FileWatcher survives GC even when no JS reference is held.
// Regression test for https://github.com/saghul/txiki.js/issues/880

const encoder = new TextEncoder();

let eventCount = 0;

const tmpDir = await tjs.makeTempDir('test_dirXXXXXX');

// Create watcher without holding a reference.
(function() {
    tjs.watch(tmpDir, (filePath, event) => {
        eventCount++;
    });
})();

// Force GC to collect unreferenced objects.
tjs.engine.gc.run();

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Give the watcher time to settle.
await sleep(1000);

// Trigger a file change — the watcher should still be alive.
const f = await tjs.makeTempFile(path.join(tmpDir, 'test_fileXXXXXX'));
const p = f.path;
await f.write(encoder.encode('hello'));
await f.close();

await sleep(1000);

assert.ok(eventCount > 0, `expected events after GC, got ${eventCount}`);

// Clean up: we can't call .close() on the watcher since we don't have a reference,
// but we can clean up the temp files.
await tjs.remove(p);
await tjs.remove(tmpDir);

tjs.exit(0);

