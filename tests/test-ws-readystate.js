import assert from 'tjs:assert';

const url = 'wss://websocket-echo.com';
const ws = new WebSocket(url);

assert.eq(ws.readyState, ws.CONNECTING, 'readyState is CONNECTING');

ws.addEventListener('open', () => {
    assert.eq(ws.readyState, ws.OPEN, 'readyState is OPEN');

    ws.close();
    assert.eq(ws.readyState, ws.CLOSING, 'readyState is CLOSING');
});

ws.addEventListener('close', () => {
    assert.eq(ws.readyState, ws.CLOSED, 'readyState is CLOSED');
});
