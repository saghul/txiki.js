import assert from 'tjs:assert';


// ws.data is passed through from upgrade options.
const server = tjs.serve({
    port: 0,
    fetch(req, { server }) {
        if (server.upgrade(req, { data: { userId: '42' } })) {
            return;
        }

        return new Response('not ws');
    },
    websocket: {
        open(ws) {
            ws.sendText('your id is ' + ws.data.userId);
        },
        message(ws, data) {
            ws.sendText(data);
        },
    },
});

const ws = new WebSocket(`ws://127.0.0.1:${server.port}`);

const result = await new Promise((resolve, reject) => {
    ws.onmessage = (e) => {
        resolve(e.data);
        ws.close();
    };
    ws.onerror = () => reject(new Error('ws error'));
});

assert.eq(result, 'your id is 42', 'ws.data available in open callback');
server.close();
