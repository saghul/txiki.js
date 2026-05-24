import assert from 'tjs:assert';

import { createEchoServer } from './helpers/echo-server.js';

const { server, baseUrl } = createEchoServer();

const url = `${baseUrl}/delay/3`;
const xhr = new XMLHttpRequest();
xhr.open('GET', url);
xhr.timeout = 200;
xhr.ontimeout = async () => {
    assert.ok(true, 'ontimeout was called');
    assert.eq(xhr.readyState, xhr.DONE, 'readyState is DONE');
    await server.close();
};
xhr.send();
