import { assert } from '@tjs/std';


(async () => {
    const hostname = tjs.gethostname();

    assert.equal(typeof hostname, 'string');
})();
