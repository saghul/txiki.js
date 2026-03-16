import assert from 'tjs:assert';

import { createEchoServer } from './helpers/echo-server.js';

const { server, wsUrl } = createEchoServer();

const ws = new WebSocket(wsUrl);

assert.eq(ws.readyState, ws.CONNECTING, 'readyState is CONNECTING');

ws.addEventListener('open', () => {
    assert.eq(ws.readyState, ws.OPEN, 'readyState is OPEN');

    ws.close();
    assert.eq(ws.readyState, ws.CLOSING, 'readyState is CLOSING');
});

ws.addEventListener('close', () => {
    assert.eq(ws.readyState, ws.CLOSED, 'readyState is CLOSED');
    server.close();
});
