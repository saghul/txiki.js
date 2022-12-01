import { assert } from '@tjs/std';

const url = 'wss://websocket-echo.com';
const ws = new WebSocket(url);

ws.addEventListener('open', () => {
    // The URL will end in /
    assert.eq(ws.url.slice(0, -1), url, 'url is the same');

    ws.close();
});
