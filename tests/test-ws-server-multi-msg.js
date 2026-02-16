import assert from 'tjs:assert';


// Multiple messages.
const server = tjs.serve({
    port: 0,
    fetch(req, { server }) {
        if (server.upgrade(req, { data: { count: 0 } })) {
            return;
        }

        return new Response('not ws');
    },
    websocket: {
        message(ws, data) {
            ws.data.count++;
            ws.sendText(`${ws.data.count}: ${data}`);
        },
    },
});

const ws = new WebSocket(`ws://127.0.0.1:${server.port}`);
const messages = [];

const done = new Promise((resolve) => {
    ws.onopen = () => {
        ws.send('a');
        ws.send('b');
        ws.send('c');
    };
    ws.onmessage = (e) => {
        messages.push(e.data);

        if (messages.length === 3) {
            resolve();
        }
    };
});

await done;
ws.close();
assert.eq(messages[0], '1: a', 'first message');
assert.eq(messages[1], '2: b', 'second message');
assert.eq(messages[2], '3: c', 'third message');
server.close();
