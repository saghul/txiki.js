import assert from 'tjs:assert';


// remoteAddress is available.
let addr = null;

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
            addr = ws.remoteAddress;
            ws.close();
        },
        message() {},
    },
});

const ws = new WebSocket(`ws://127.0.0.1:${server.port}`);

await new Promise((resolve) => {
    ws.onclose = resolve;
});

assert.ok(addr, 'remoteAddress is set');
assert.ok(addr.includes('127.0.0.1'), 'remoteAddress contains 127.0.0.1');
server.close();
