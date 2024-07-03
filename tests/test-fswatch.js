import assert from 'tjs:assert';
import path from 'tjs:path';

const encoder = new TextEncoder();
const eventTypes = [ 'change', 'rename' ];

let eventCount = 0;

function watchCb(path, event) {
    eventCount++;
    assert.ok(eventTypes.includes(event));
}

async function sleep(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

const tmpDir = await tjs.makeTempDir('test_dirXXXXXX');
const watcher = tjs.watch(tmpDir, watchCb);
await sleep(1000);
const f = await tjs.makeTempFile(path.join(tmpDir, 'test_fileXXXXXX'));
const p = f.path;
await sleep(1000);
await f.write(encoder.encode('hello world'));
await f.close();
await sleep(1000);
const newPath = path.join(tmpDir, 'foo');
await tjs.rename(p, newPath);
await sleep(1000);
await tjs.remove(newPath);
await sleep(1000);
watcher.close();
await tjs.remove(tmpDir);
assert.ok(eventCount >= 5);
