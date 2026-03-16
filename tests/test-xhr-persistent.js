import assert from 'tjs:assert';

import { createEchoServer } from './helpers/echo-server.js';

const { server, baseUrl } = createEchoServer();

function doXhr(url) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url);
        xhr.onload = () => resolve(xhr);
        xhr.onerror = () => reject(new Error('XHR error'));
        xhr.send();
    });
}

const url = `${baseUrl}/get`;

const xhr1 = await doXhr(url);
assert.eq(xhr1.readyState, xhr1.DONE, 'readyState is DONE');
assert.eq(xhr1.responseURL, url, 'url is the same');
assert.eq(xhr1.status, 200, 'status is 200');

const xhr2 = await doXhr(url);
assert.eq(xhr2.readyState, xhr2.DONE, 'readyState is DONE');
assert.eq(xhr2.responseURL, url, 'url is the same');
assert.eq(xhr2.status, 200, 'status is 200');

server.close();
