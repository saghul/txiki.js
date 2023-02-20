import assert from 'tjs:assert';


assert.ok(typeof tjs.errors.EINVAL !== 'undefined');

const e = new tjs.Error(tjs.errors.EINVAL);

assert.eq(e.errno, tjs.errors.EINVAL);
assert.eq(e.code, 'EINVAL');
assert.eq(e.message, tjs.errors.strerror(tjs.errors.EINVAL));
