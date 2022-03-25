import assert from './assert.js';

(async () => {
    let server, error;

    try  {
        server = await tjs.listen('tcp', '127.0.0.1', 0, { ipv6Only: true });
    } catch (err) {
        error = err;
    }
     
    assert.is(server, undefined);
    assert.ok(error);
    assert.eq(error.errno, tjs.Error.EINVAL);
})();
