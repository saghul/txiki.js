import assert from 'tjs:assert';


// Mixed HTTP + WS on the same server.
const server = tjs.serve({
    port: 0,
    fetch(req, { server }) {
        const url = new URL(req.url);

        if (url.pathname === '/ws' && server.upgrade(req)) {
            return;
        }

        return new Response('http ok');
    },
    websocket: {
        message(ws, data) {
            ws.sendText('ws: ' + data);
        },
    },
});

const base = `http://127.0.0.1:${server.port}`;

// HTTP request.
const resp = await fetch(`${base}/hello`);
assert.eq(resp.status, 200, 'HTTP status 200');
assert.eq(await resp.text(), 'http ok', 'HTTP body matches');

// WS connection.
const ws = new WebSocket(`ws://127.0.0.1:${server.port}/ws`);

const wsResult = await new Promise((resolve, reject) => {
    ws.onopen = () => ws.send('test');
    ws.onmessage = (e) => {
        resolve(e.data);
        ws.close();
    };
    ws.onerror = () => reject(new Error('ws error'));
});

assert.eq(wsResult, 'ws: test', 'WS echo works alongside HTTP');
server.close();
