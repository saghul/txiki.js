import assert from 'tjs:assert';

const url = 'wss://websocket-echo.com';
const ws = new WebSocket(url);

ws.addEventListener('open', () => {
    assert.throws(() => ws.close(1234), RangeError, 'Out of range');

    const u8 = new Uint8Array(1024).fill(65);
    const bogusReason = new TextDecoder().decode(u8);

    assert.throws(() => ws.close(3000, bogusReason), SyntaxError, 'Too large reason');

    ws.close(3000, 'Good bye!');
});
