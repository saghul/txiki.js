import assert from 'tjs:assert';

import { spawnServe } from './helpers/serve-spawn.js';


// The upgrade Request must carry the full URL including the query string
// (lws strips it from the URI header, so the server reconstructs it).
async function testUpgradeUrlKeepsQueryString() {
    const { proc, port } = await spawnServe('serve-ws-url.js');

    try {
        const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?token=s3cr3t&x=1`);

        const url = await new Promise((resolve, reject) => {
            ws.onopen = () => ws.send('url?');
            ws.onmessage = e => {
                resolve(e.data);
                ws.close();
            };
            ws.onerror = () => reject(new Error('WebSocket error'));
        });

        assert.ok(url.endsWith('/ws?token=s3cr3t&x=1'), `query string preserved (got: ${url})`);
    } finally {
        proc.kill('SIGTERM');
        await proc.wait();
    }
}

await testUpgradeUrlKeepsQueryString();
