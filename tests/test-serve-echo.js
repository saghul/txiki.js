import assert from 'tjs:assert';

import { spawnServe } from './helpers/serve-spawn.js';


async function testServeEcho() {
    const { proc, port } = await spawnServe('serve-simple.js');

    try {
        const resp = await fetch(`http://127.0.0.1:${port}/echo`, {
            method: 'POST',
            body: 'test body',
        });
        assert.eq(resp.status, 200, 'status is 200');

        const text = await resp.text();
        assert.eq(text, 'echo: test body', 'echo body matches');
    } finally {
        proc.kill('SIGTERM');
        await proc.wait();
    }
}

await testServeEcho();
