import assert from './assert.js';


(async () => {
    const hostname = tjs.gethostname();

    assert.equal(typeof hostname,'string');
})();
