import assert from 'tjs:assert';


// Async fetch handler with upgrade before await.
const server = tjs.serve({
    port: 0,
    async fetch(req, { server }) {
        if (server.upgrade(req)) {
            return;
        }

        return new Response('http ok');
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
    ws.onerror = () => reject(new Error('ws error'));
});

assert.eq(result, 'echo: hello', 'async handler upgrade works');
server.close();
