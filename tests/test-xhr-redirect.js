import assert from 'tjs:assert';

import { createEchoServer } from './helpers/echo-server.js';

const { server, baseUrl } = createEchoServer();

const url = `${baseUrl}/redirect`;
const targetUrl = `${baseUrl}/redirect-target`;

const xhr = new XMLHttpRequest();
xhr.open('GET', url);
xhr.onloadend = () => {
    assert.eq(xhr.readyState, xhr.DONE, 'readyState is DONE');
    assert.eq(xhr.status, 200, 'status is 200');
    assert.ok(xhr.responseURL.startsWith(targetUrl), 'url was redirected');
    assert.ok(xhr.responseText.length > 0, 'response body is not empty');
    server.close();
};
xhr.send();
