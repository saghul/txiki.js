import assert from 'tjs:assert';

import { createEchoServer } from './helpers/echo-server.js';

const { server, wsUrl } = createEchoServer();

const ws = new WebSocket(wsUrl);

ws.addEventListener('open', async () => {
    // The URL will end in /
    assert.eq(ws.url.slice(0, -1), wsUrl, 'url is the same');

    ws.close();
    await server.close();
});
