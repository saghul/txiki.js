import assert from '@tjs/std/assert';

const proto = 'echo1234';
const url = 'wss://websocket-echo.com';
const ws = new WebSocket(url, [proto]);

console.log('apa');

ws.addEventListener('open', () => {
    assert.eq(ws.protocol, proto, 'protocol is the same');

    ws.close();
});
