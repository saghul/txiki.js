import assert from 'tjs:assert';

const proto = 'echo1234';
const url = 'wss://websocket-echo.com';
const ws = new WebSocket(url, [ proto ]);


ws.addEventListener('open', () => {
    assert.eq(ws.protocol, proto, 'protocol is the same');

    ws.close();
});
