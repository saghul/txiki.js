import assert from 'tjs:assert';

import { spawnServe } from './helpers/serve-spawn.js';


async function testServeWebSocket() {
    const { proc, port } = await spawnServe('serve-ws.js');

    try {
        // Test that non-WS requests still work.
        const resp = await fetch(`http://127.0.0.1:${port}/`);
        assert.eq(await resp.text(), 'not a websocket request', 'non-ws request works');

        // Test WebSocket echo.
        const ws = new WebSocket(`ws://127.0.0.1:${port}`);

        const result = await new Promise((resolve, reject) => {
            ws.onopen = () => ws.send('hello ws');
            ws.onmessage = (e) => {
                resolve(e.data);
                ws.close();
            };
            ws.onerror = () => reject(new Error('WebSocket error'));
        });

        assert.eq(result, 'echo: hello ws', 'ws echo matches');
    } finally {
        proc.kill('SIGTERM');
        await proc.wait();
    }
}

await testServeWebSocket();
