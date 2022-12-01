import { assert } from '@tjs/std';


(async () => {
    assert.ok(tjs.pid > 0);
    assert.ok(tjs.ppid > 0);
})();
