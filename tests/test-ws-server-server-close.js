import assert from 'tjs:assert';


// Server-initiated close.
let serverCloseFired = false;
const serverClosed = new Promise((resolve) => {
    serverCloseFired = resolve;
});

const server = tjs.serve({
    port: 0,
    fetch(req, { server }) {
        if (server.upgrade(req)) {
            return;
        }

        return new Response('not ws');
    },
    websocket: {
        open(ws) {
            ws.close(4001, 'server bye');
        },
        message() {},
        close() {
            serverCloseFired(true);
        },
    },
});

const ws = new WebSocket(`ws://127.0.0.1:${server.port}`);

await new Promise((resolve) => {
    ws.onclose = resolve;
});

const result = await serverClosed;
assert.ok(result, 'server close callback fired');
server.close();
