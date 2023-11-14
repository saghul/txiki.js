import assert from 'tjs:assert';

const ab = new ArrayBuffer(16);
const u8 = new Uint8Array(ab, 8).fill(1);
u8[7] = 2;
let cnt = 0;
let round = 0;
const msgs = [
    'PING',
    'PANG',
    ab,
    u8,
    new Blob([ab])
];
const url = 'wss://websocket-echo.com';
const ws = new WebSocket(url);

ws.addEventListener('open', () => sendNext());

ws.addEventListener('message', async ev => {
    const data = ev.data;
    const orig = msgs[cnt];

    if (typeof data === 'string') {
        assert.eq(data, orig, 'received data matches');
    } else {
        const origView = new Uint8Array(orig instanceof Blob ? await orig.arrayBuffer() : orig);
        const view = new Uint8Array(data instanceof Blob ? await data.arrayBuffer() : data);

        for (let i = 0; i < view.byteLength; i++) {
            assert.eq(view[i], origView[i], 'received data matches');
        }
    }

    cnt++;
    sendNext();
});

function sendNext() {
    if (cnt > msgs.length - 1) {
        if (round === 0) {
            ws.binaryType = 'arraybuffer';
            cnt = 0;
            round++;
            setTimeout(() => {
                sendNext();
            }, 0);
        } else {
            ws.close();
        }
    } else {
        ws.send(msgs[cnt]);
    }
}
