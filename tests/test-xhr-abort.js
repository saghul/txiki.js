import assert from 'tjs:assert';

import { createEchoServer } from './helpers/echo-server.js';

const { server, baseUrl } = createEchoServer();

const url = `${baseUrl}/delay/3`;
const xhr = new XMLHttpRequest();
xhr.open('GET', url);
xhr.onabort = () => {
    assert.ok(true, 'onabort was called');
    assert.eq(xhr.readyState, xhr.UNSENT, 'readyState is UNSENT');
    server.close();
};
xhr.send();
setTimeout(() => {
    xhr.abort();
}, 200);
