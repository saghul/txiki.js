import assert from './assert.js';

(async function() {
    const res1 = await tjs.getaddrinfo('google.com', 80, { socktype: tjs.SOCK_STREAM, protocol: tjs.IPPROTO_TCP });
    assert.ok(res1[0].addr.ip, 'there is a result');
    assert.eq(res1[0].addr.port, 80);

    const res2 = await tjs.getaddrinfo('google.com', 'http', { socktype: tjs.SOCK_STREAM, protocol: tjs.IPPROTO_TCP });
    assert.ok(res2[0].addr.ip, 'there is a result');
    assert.eq(res2[0].addr.port, 80);

    const res3 = await tjs.getaddrinfo('google.com');
    assert.ok(res3[0].addr.ip, 'there is a result');
    assert.eq(res3[0].addr.port, 0);
})();
