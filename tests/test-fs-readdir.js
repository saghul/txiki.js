import assert from './assert.js';

const dirs = [ 'advanced', 'fixtures', 'helpers', 'wasi', 'wasm' ];


(async () => {
    const dirIter = await tjs.readdir(import.meta.dirname);

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
})();
