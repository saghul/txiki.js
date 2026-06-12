import assert from 'tjs:assert';

import { createEchoServer } from './helpers/echo-server.js';

const { server, baseUrl } = createEchoServer();

// A response that arrives after the deadline must reject.
try {
    await fetch(`${baseUrl}/delay/3`, { timeout: 200 });
    assert.ok(false, 'fetch should have timed out');
} catch (e) {
    assert.ok(e instanceof TypeError, 'rejects with TypeError');
    assert.ok(/timed out/i.test(e.message), 'message mentions the timeout');
}

// A request that completes within the deadline is unaffected.
const res = await fetch(`${baseUrl}/get`, { timeout: 5000 });

assert.eq(res.status, 200, 'fast request succeeds with a timeout set');

await server.close();
