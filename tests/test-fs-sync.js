import assert from './assert.js';

const encoder = new TextEncoder();


(async () => {
    const f = await tjs.mkstemp('test_fileXXXXXX');
    const path = f.path;
    await f.write(encoder.encode('hello world'));
    await f.datasync();
    await f.sync();
    await f.close();
    await tjs.unlink(path);
})();
