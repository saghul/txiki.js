import assert from 'tjs:assert';

import { createEchoServer } from './helpers/echo-server.js';

const { server, baseUrl } = createEchoServer();

const data = JSON.stringify({ foo: 'bar', bar: 'baz' });
const url = `${baseUrl}/post`;
const xhr = new XMLHttpRequest();
xhr.open('POST', url);
xhr.responseType = 'json';
xhr.setRequestHeader('Content-Type', 'application/json');
xhr.onloadend = () => {
    assert.eq(xhr.readyState, xhr.DONE, 'readyState is DONE');
    assert.eq(xhr.responseURL, url, 'url is the same');
    assert.eq(xhr.status, 200, 'status is 200');
    assert.eq(JSON.stringify(xhr.response.data), data, 'sent and received data match');
    server.close();
};
xhr.send(data);
