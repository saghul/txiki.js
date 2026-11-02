import assert from 'tjs:assert';
import cert from './fixtures/server-cert.pem' with { type: 'text' };
import key from './fixtures/server-key.pem' with { type: 'text' };

// Skipped under GC stress: h2 response bodies stall there (t_a77e0129), so the
// timing this test relies on no longer holds.
if (tjs.env.TJS_GC_STRESS) {
    tjs.exit(0);
}

// HTTP/2: fetches aborted one after another on a pooled connection that another
// stream keeps open each reset their stream, so they don't pile up on it. Without
// the reset the server kept every aborted stream open and sending, and after
// about 23 of them the next fetch on the connection failed.
//
// The server advertises only "h2", so this can never pass over HTTP/1.1.

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const N = 40;

let cancelled = 0;
const server = tjs.serve({
    port: 0,
    listenIp: '127.0.0.1',
    tls: { cert, key, alpn: [ 'h2' ] },
    fetch: () => new Response(new ReadableStream({
        async pull(controller) {
            await sleep(5);
            controller.enqueue(new Uint8Array(1024));
        },
        cancel() {
            cancelled++;
        },
    })),
});
const url = `https://127.0.0.1:${server.port}/`;
const keep = new AbortController();

try {
    const kept = await fetch(url, { allowInsecure: true, signal: keep.signal });

    await kept.body.getReader().read();

    for (let i = 0; i < N; i++) {
        const ac = new AbortController();
        const r = await fetch(url, { allowInsecure: true, signal: ac.signal }).catch(e => e);

        assert.ok(r instanceof Response, `fetch #${i} on the pooled connection: ${r}`);

        const { done } = await r.body.getReader().read();

        assert.ok(!done, `fetch #${i} got a chunk`);
        ac.abort();
    }

    const deadline = Date.now() + 1000;

    while (cancelled < N && Date.now() < deadline) {
        await sleep(10);
    }

    assert.eq(cancelled, N, 'the server cancelled every aborted body');
} finally {
    keep.abort();
    await server.close();
}
