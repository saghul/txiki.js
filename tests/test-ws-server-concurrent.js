import assert from 'tjs:assert';


// Multiple concurrent WS connections.
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

const N = 5;
const results = [];
const promises = [];

for (let i = 0; i < N; i++) {
    const p = new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://127.0.0.1:${server.port}`);

        ws.onopen = () => ws.send(`msg-${i}`);
        ws.onmessage = (e) => {
            results.push(e.data);
            ws.close();
            resolve();
        };
        ws.onerror = () => reject(new Error(`ws ${i} error`));
    });

    promises.push(p);
}

await Promise.all(promises);

assert.eq(results.length, N, `got ${N} results`);

for (let i = 0; i < N; i++) {
    assert.ok(results.includes(`echo: msg-${i}`), `got echo for msg-${i}`);
}

server.close();
