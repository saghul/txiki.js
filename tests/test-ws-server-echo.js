import assert from 'tjs:assert';


// Basic WS echo server.
const server = tjs.serve({
    port: 0,
    fetch(req, { server }) {
        if (server.upgrade(req)) {
            return;
        }

        return new Response('not ws');
    },
    websocket: {
        message(ws, data) {
            ws.sendText('echo: ' + data);
        },
    },
});

const ws = new WebSocket(`ws://127.0.0.1:${server.port}`);

const result = await new Promise((resolve, reject) => {
    ws.onopen = () => ws.send('hello');
    ws.onmessage = (e) => {
        resolve(e.data);
        ws.close();
    };
    ws.onerror = (e) => reject(new Error('ws error'));
});

assert.eq(result, 'echo: hello', 'echo message matches');
server.close();
