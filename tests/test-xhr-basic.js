import assert from 'tjs:assert';

import { createEchoServer } from './helpers/echo-server.js';

const { server, baseUrl } = createEchoServer();

const url = `${baseUrl}/get`;
const xhr = new XMLHttpRequest();
xhr.open('GET', url);
xhr.onloadend = () => {
    assert.eq(xhr.readyState, xhr.DONE, 'readyState is DONE');
    assert.eq(xhr.responseURL, url, 'url is the same');
    assert.eq(xhr.status, 200, 'status is 200');
    server.close();
};
xhr.send();

// Synchronous XHR should throw
assert.throws(() => {
    const xhrSync = new XMLHttpRequest();
    xhrSync.open('GET', url, false);
}, TypeError, 'sync XHR throws TypeError');
