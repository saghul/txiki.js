import assert from 'tjs:assert';

import { createEchoServer } from './helpers/echo-server.js';

const { server, wsUrl } = createEchoServer();

const proto = 'echo1234';
const ws = new WebSocket(wsUrl, [ proto ]);


ws.addEventListener('open', () => {
    assert.eq(ws.protocol, proto, 'protocol is the same');

    ws.close();
    server.close();
});
