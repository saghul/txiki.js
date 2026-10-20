import assert from 'tjs:assert';

import { createRawH2Server } from './helpers/raw-h2-server.js';

// Google's front ends send a PING right after a response. A second request on
// the pooled h2 connection must still go out: the client holds new streams
// back until stream 1 has sent its headers, and that check must ask stream 1,
// not whichever stream the last parsed frame was on (stream 0 for a PING).

const SETTINGS_MAX_CONCURRENT_STREAMS = 0x3;

const server = await createRawH2Server({
    settings: [ [ SETTINGS_MAX_CONCURRENT_STREAMS, 100 ] ],
    pingAfterResponse: true,
});

try {
    for (let i = 0; i < 2; i++) {
        const r = await fetch(`https://127.0.0.1:${server.port}/`, {
            allowInsecure: true,
            signal: AbortSignal.timeout(5000),
        });

        await r.arrayBuffer();
        assert.eq(r.status, 200, `response ${i} received`);
    }

    assert.eq(server.requestSids, [ 1, 3 ], 'both requests on one connection');
} finally {
    await server.close();
}
