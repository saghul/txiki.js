import assert from 'tjs:assert';


// When no subprotocol is requested and the server does not negotiate one,
// ws.protocol must be '' (empty string).
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
            ws.sendText(data);
        },
    },
});

const ws = new WebSocket(`ws://127.0.0.1:${server.port}`);

const protocol = await new Promise((resolve, reject) => {
    ws.onopen = () => {
        resolve(ws.protocol);
        ws.close();
    };
    ws.onerror = () => reject(new Error('ws error'));
});

assert.eq(protocol, '', 'protocol must be empty when none requested');
server.close();
