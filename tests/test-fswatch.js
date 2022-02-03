import { path } from '@tjs/std';
import assert from './assert.js';

const encoder = new TextEncoder();

let eventCount = 0;

function watchCb(path, flags) {
    eventCount++;
}

async function sleep(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

(async () => {
    const tmpDir = await tjs.fs.mkdtemp('test_dirXXXXXX');
    const watcher = tjs.fs.watch(tmpDir, watchCb);
    await sleep(1000);
    const f = await tjs.fs.mkstemp(path.join(tmpDir, 'test_fileXXXXXX'));
    const p = f.path;
    await sleep(1000);
    await f.write(encoder.encode('hello world'));
    await f.close();
    await sleep(1000);
    const newPath = path.join(tmpDir, 'foo');
    await tjs.fs.rename(p, newPath);
    await sleep(1000);
    await tjs.fs.unlink(newPath);
    await sleep(1000);
    watcher.close();
    await tjs.fs.rmdir(tmpDir);
    assert.eq(eventCount, 5);
})();
