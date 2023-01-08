import assert from '@tjs/std/assert';

(async () => {
    const hostname = tjs.gethostname();

    assert.equal(typeof hostname, 'string');
})();
