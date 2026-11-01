import assert from 'tjs:assert';

import { createRawH2Server } from './helpers/raw-h2-server.js';

// A server's SETTINGS frame may be empty (Node's http2 sends one by default).
// The client still has to send its request: lws moves it onto h2 stream 1 when
// the server's SETTINGS frame completes, and an empty frame has no payload to
// complete on. The response is held back so it can't race the client's own
// END_STREAM bookkeeping (test-fetch-h2-fast-response.js covers that).

const server = await createRawH2Server({ settings: [], responseDelayMs: 200 });

try {
    const r = await fetch(`https://127.0.0.1:${server.port}/`, {
        allowInsecure: true,
        signal: AbortSignal.timeout(5000),
    });

    await r.arrayBuffer();

    assert.eq(await server.requestSid, 1, 'request sent on stream 1');
    assert.eq(r.status, 200, 'response received');
} finally {
    await server.close();
}
