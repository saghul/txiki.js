import assert from './assert.js';


(async () => {
    assert.ok(tjs.pid > 0);
    assert.ok(tjs.ppid > 0);
})();
