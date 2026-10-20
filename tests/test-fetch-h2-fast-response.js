import assert from 'tjs:assert';

import { createRawH2Server } from './helpers/raw-h2-server.js';

// A GET goes out as a HEADERS frame carrying END_STREAM. A server that answers
// at once, before the client's next write pass, must still complete the
// request: the client stream has to be half-closed (local) from the moment its
// END_STREAM is sent, so the response's END_STREAM closes it.

const SETTINGS_MAX_CONCURRENT_STREAMS = 0x3;

const server = await createRawH2Server({ settings: [ [ SETTINGS_MAX_CONCURRENT_STREAMS, 100 ] ] });

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
