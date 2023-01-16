import assert from 'tjs:assert';


(async () => {
    const hostname = tjs.gethostname();

    assert.equal(typeof hostname, 'string');
})();
