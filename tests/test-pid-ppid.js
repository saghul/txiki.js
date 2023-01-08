import assert from '@tjs/std/assert';

(async () => {
    assert.ok(tjs.pid > 0);
    assert.ok(tjs.ppid > 0);
})();
